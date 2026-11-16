import { expect, test } from 'bun:test';
import { FORGET_UNREAD_AFTER, REFRESH_AFTER, RETRY_FAILED_REFRESH_AFTER, servePage, type PageStore, type StoredPagesEnv } from '@/src/lib/stored-pages';

const DAY = 24 * 60 * 60 * 1000;
const article = 'https://example.com/article';

/** Stands in for KV, including its expiry, and for the API behind it. */
function world(options: { env?: Partial<StoredPagesEnv>; pageBytes?: number } = {}) {
  const state = {
    now: Date.UTC(2026, 0, 1),
    api: 'up' as 'up' | 'down' | 'busy' | 'garbage', // down: unreachable,
    captures: [] as Array<{ url: string; headers: Record<string, string> }>,
    edition: 0,
    storeDown: false,
  };
  const kept = new Map<string, { value: string; metadata: unknown; expires: number }>();
  const live = (key: string) => {
    const entry = kept.get(key);
    if (entry && entry.expires <= state.now) kept.delete(key);
    return kept.get(key);
  };
  const store: PageStore = {
    async get(key) { return live(key)?.value ?? null; },
    async getWithMetadata(key) {
      if (state.storeDown) throw new Error('KV unavailable');
      const entry = live(key);
      return { value: entry?.value ?? null, metadata: entry?.metadata ?? null };
    },
    async put(key, value, { expirationTtl, metadata } = {}) {
      kept.set(key, { value, metadata, expires: expirationTtl ? state.now + expirationTtl * 1000 : Infinity });
    },
    async delete(key) { kept.delete(key); },
    async list({ prefix }) {
      const keys = [...kept.keys()].filter(key => key.startsWith(prefix) && live(key))
        .map(name => ({ name, metadata: kept.get(name)!.metadata }));
      return { keys, list_complete: true };
    },
  };
  const background: Promise<unknown>[] = [];
  const env: StoredPagesEnv = { PAGES: store, ...options.env };
  async function read(url = article, visitor = '203.0.113.7') {
    const response = await servePage(
      new Request(`https://henry.ink/api/archive?${new URLSearchParams({ url })}`, { headers: { 'CF-Connecting-IP': visitor } }),
      env, work => { background.push(work); },
      {
        now: () => state.now,
        fetch: async (target, init) => {
          state.captures.push({ url: target, headers: { ...(init.headers as Record<string, string>) } });
          if (state.api === 'down') throw new TypeError('fetch failed');
          if (state.api === 'busy') return Response.json({ error: 'Too many captures' }, { status: 429, headers: { 'Retry-After': '5' } });
          if (state.api === 'garbage') return new Response('<html>gateway page</html>');
          const source = new URL(target).searchParams.get('url')!;
          return Response.json({ html: `<p>${source} edition ${++state.edition}</p>${'x'.repeat(options.pageBytes ?? 0)}`, textContent: 'Article', resolvedUrl: source });
        },
      },
    );
    const text = await response.text();
    await Promise.all(background.splice(0));
    return { response, text, html: response.ok ? (JSON.parse(text).html as string).replace(/x+$/, '') : '' };
  }
  return { state, read, copies: () => [...kept.keys()].filter(key => key.startsWith('page:') && live(key)).length };
}

test('a page that opened once keeps opening without the API', async () => {
  const { state, read } = world();
  const first = await read();
  expect(first.response.headers.get('X-Page-Copy')).toBe('captured');
  state.api = 'down';
  for (const url of [article, `${article}#section`]) {
    const again = await read(url);
    expect(again.response.status).toBe(200);
    expect(again.html).toBe(first.html);
    expect(again.response.headers.get('X-Page-Copy')).toBe('stored');
  }
  expect(state.captures).toHaveLength(1);
});

test('a failed capture is shown to the reader and never stored', async () => {
  const { state, read, copies } = world();
  state.api = 'busy';
  const busy = await read();
  expect(busy.response.status).toBe(429);
  expect(busy.response.headers.get('Retry-After')).toBe('5');
  expect(busy.response.headers.get('Access-Control-Expose-Headers')).toContain('Retry-After');
  state.api = 'down';
  expect((await read()).response.status).toBe(502);
  state.api = 'garbage';
  expect((await read()).response.status).toBe(502);
  expect(copies()).toBe(0);
  state.api = 'up';
  expect((await read()).html).toContain('edition 1');
  expect(copies()).toBe(1);
});

test('a copy is refreshed at most weekly, behind the reader who triggered it', async () => {
  const { state, read } = world();
  await read();
  state.now += REFRESH_AFTER - 1000;
  for (let i = 0; i < 5; i++) expect((await read()).html).toContain('edition 1');
  expect(state.captures).toHaveLength(1);
  state.now += 2000;
  // The reader who triggers the refresh still gets the copy on hand, at once.
  expect((await read()).html).toContain('edition 1');
  expect(state.captures).toHaveLength(2);
  const next = await read();
  expect(next.html).toContain('edition 2');
  expect(next.response.headers.get('X-Page-Captured')).toBe(new Date(state.now).toISOString());
  expect(state.captures).toHaveLength(2);
});

test('a failed refresh keeps the last good copy and waits a day before trying again', async () => {
  const { state, read } = world();
  await read();
  state.now += REFRESH_AFTER + 1000;
  for (const failure of ['down', 'busy', 'garbage'] as const) {
    state.api = failure;
    expect((await read()).html).toContain('edition 1');
    const attempts = state.captures.length;
    expect((await read()).html).toContain('edition 1');
    expect(state.captures).toHaveLength(attempts);
    state.now += RETRY_FAILED_REFRESH_AFTER + 1000;
  }
  state.api = 'up';
  await read();
  expect((await read()).html).toContain('edition 2');
});

test('a copy nobody reads is forgotten after about 90 days; one that is read is kept', async () => {
  const { state, read, copies } = world();
  await read();
  await read('https://example.com/unread');
  // Read one of them every month for half a year.
  for (let month = 0; month < 6; month++) {
    state.now += 30 * DAY;
    expect((await read()).response.headers.get('X-Page-Copy')).toBe('stored');
  }
  expect(copies()).toBe(1);
  state.now += FORGET_UNREAD_AFTER + DAY;
  expect(copies()).toBe(0);
  expect((await read()).response.headers.get('X-Page-Copy')).toBe('captured');
});

test('when storage fills, the least recently read copies go first', async () => {
  const { state, read, copies } = world({ env: { PAGES_MAX_BYTES: String(350_000) }, pageBytes: 100_000 });
  for (const name of ['old', 'loved', 'recent']) {
    await read(`https://example.com/${name}`);
    state.now += DAY;
  }
  // "loved" is the oldest capture but has just been read again (and refreshed).
  state.now += REFRESH_AFTER;
  await read('https://example.com/loved');
  state.now += DAY;
  await read('https://example.com/newest');
  expect(copies()).toBe(3);
  state.api = 'down';
  expect((await read('https://example.com/old')).response.status).toBe(502);
  for (const name of ['loved', 'recent', 'newest']) expect((await read(`https://example.com/${name}`)).response.status).toBe(200);
});

test('every copy is served inert, unindexed, readable from any origin, and linked to its original', async () => {
  const { read } = world();
  for (const copy of ['captured', 'stored']) {
    const { response } = await read(`${article}?a=1#part`);
    expect(response.headers.get('X-Page-Copy')).toBe(copy);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(response.headers.get('Link')).toBe(`<${article}?a=1>; rel="canonical"`);
    const policy = response.headers.get('Content-Security-Policy')!;
    expect(policy).toContain("script-src 'none'");
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain('img-src https://api.henry.ink/api/asset-proxy');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Vary')).toBeNull();
  }
});

test('the API hears which visitor is asking only alongside the shared key', async () => {
  const keyed = world({ env: { EDGE_KEY: 'k'.repeat(40), API_ORIGIN: 'https://api.test' } });
  await keyed.read(article, '198.51.100.9');
  expect(keyed.state.captures[0].url).toBe(`https://api.test/api/archive?url=${encodeURIComponent(article)}`);
  expect(keyed.state.captures[0].headers).toEqual({ 'X-Henry-Visitor': '198.51.100.9', 'X-Henry-Edge-Key': 'k'.repeat(40) });
  const keyless = world();
  await keyless.read();
  expect(keyless.state.captures[0].headers).toEqual({});
});

test('without storage, or while storage is failing, readers are still served by the API', async () => {
  const unbound = world({ env: { PAGES: undefined } });
  expect((await unbound.read()).html).toContain('edition 1');
  expect((await unbound.read()).html).toContain('edition 2');
  const outage = world();
  await outage.read();
  outage.state.storeDown = true;
  expect((await outage.read()).html).toContain('edition 2');
});

test('an address that carries a credential is served but never kept', async () => {
  const { state, read, copies } = world();
  for (const url of [`${article}?token=abc`, `${article}?X-Amz-Signature=abc&X-Amz-Expires=60`, 'https://user:pass@example.com/doc']) {
    expect((await read(url)).html).toContain('edition');
    expect((await read(url)).response.status).toBe(200);
  }
  expect(copies()).toBe(0);
  expect(state.captures).toHaveLength(6);
  await read(`${article}?page=2&author=key`);
  expect(copies()).toBe(1);
});
