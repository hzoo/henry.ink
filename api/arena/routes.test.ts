import { expect, test } from 'bun:test';
import { createArenaLookupRoute } from '@/api/arena/routes';
import type { ArenaLookupPage } from '@/src/lib/arena-types';

const target = 'https://source.example/Case?key=a%2Fb&tag=one+two';
const request = (source = target, page = 1) => new Request(`https://api.henry.ink/api/arena/lookup?${new URLSearchParams({ url: source, page: String(page) })}`, { headers: { Origin: 'https://henry.ink' } });
const block = (id: number, url: unknown = target) => ({ id, title: `Save ${id}`, source: { url } });
const channel = (slug: string, status = 'closed') => ({ slug, title: slug, status, user: { slug: 'reader', full_name: 'Reader' } });

test('finds saved source URLs, excludes mere mentions, and only exposes public channel provenance', async () => {
  const calls: string[] = [];
  const route = createArenaLookupRoute(async (input, init) => {
    const url = new URL(input);
    calls.push(url.pathname);
    expect(url.origin).toBe('https://api.are.na');
    expect(init?.redirect).toBe('error');
    const headers = new Headers(init?.headers);
    for (const key of ['Authorization', 'x-app-token', 'x-auth-token']) expect(headers.has(key)).toBe(false);
    if (url.pathname === '/v2/search') {
      expect(url.searchParams.get('q')).toBe(target);
      return Response.json({ blocks: [{ ...block(1), class: 'Text', content: 'The interesting passage someone kept.',
        created_at: '2022-04-04T18:41:08.612Z', user: { slug: 'author', full_name: 'Original collector' },
        image: { thumb: { url: 'http://localhost/unsafe.png' }, display: { url: 'https://images.are.na/preview.png' } },
      }, { ...block(2, `${target}#another`), title: '', class: 'Link', source: { url: `${target}#another`, title: 'Original source title' },
        description: target, created_at: 'not a date', image: { thumb: { url: 'https://unrelated.example/image.png' } } }, block(1),
        block(3, target.replace('/Case', '/case')), block(4, target.replace('one+two', 'other')),
        { id: 5, content: target }, block(6, 'https://other.example/Case'), block(-1), block(7, 42)], total_pages: 1 });
    }
    return Response.json({ channels: [{ ...channel('shared'), metadata: { description: 'Tools for thinking together.' }, length: 214,
      added_to_at: '2025-01-17T15:11:08.954Z' }, channel('open', 'public'), channel('private', 'private'), channel('unknown', ''),
      { ...channel('group'), group: { slug: 'reading-group', name: 'Reading group' } }], total_pages: 2 });
  });
  const response = await route(request(`${target}#quote`));
  expect(response.status).toBe(200);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://henry.ink');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const result: ArenaLookupPage = await response.json();
  expect(result.blocks.map(item => item.id)).toEqual([1, 2]);
  expect(result.blocks[0]).toMatchObject({ kind: 'Text', excerpt: 'The interesting passage someone kept.',
    creator: { slug: 'author', name: 'Original collector' }, createdAt: '2022-04-04T18:41:08.612Z', previewUrl: 'https://images.are.na/preview.png' });
  expect(result.blocks[1]).toEqual({ id: 2, title: 'Original source title', sourceTitle: 'Original source title', kind: 'Link', channels: result.blocks[1].channels });
  expect(result.blocks[0].channels).toEqual({ state: 'ready', hasMore: true, items: [
    { slug: 'shared', title: 'shared', visibility: 'closed', description: 'Tools for thinking together.', blockCount: 214, owner: { slug: 'reader', name: 'Reader' } },
    { slug: 'open', title: 'open', visibility: 'public', owner: { slug: 'reader', name: 'Reader' } },
    { slug: 'group', title: 'group', visibility: 'closed', owner: { slug: 'reading-group', name: 'Reading group' } },
  ] });
  expect(result.nextPage).toBeNull();
  await route(request(`${target}#different`));
  expect(calls.sort()).toEqual(['/v2/blocks/1/channels', '/v2/blocks/2/channels', '/v2/search']);
});

test('keeps search pagination and partial saves recoverable without caching failed channel reads', async () => {
  let unavailable = true;
  let searches = 0;
  const route = createArenaLookupRoute(async input => {
    const url = new URL(input);
    if (url.pathname === '/v2/search') {
      searches++;
      return Response.json({ blocks: url.searchParams.get('page') === '1' ? [{ id: 9, content: target }] : [block(1), block(2)], total_pages: 2 });
    }
    if (url.pathname === '/v2/blocks/1/channels' && unavailable) return Response.json({}, { status: 503 });
    return Response.json({ channels: [channel('shared')], total_pages: 1 });
  });
  expect(await (await route(request())).json()).toEqual({ blocks: [], nextPage: 2 });
  const partial: ArenaLookupPage = await (await route(request(target, 2))).json();
  expect(partial.blocks[0].channels).toEqual({ state: 'error' });
  expect(partial.blocks[1].channels.state).toBe('ready');
  unavailable = false;
  const recovered: ArenaLookupPage = await (await route(request(target, 2))).json();
  expect(recovered.blocks.every(item => item.channels.state === 'ready')).toBe(true);
  await route(request(target, 2));
  expect(searches).toBe(3);
});

test('coalesces repeated URL requests and limits concurrent channel lookups', async () => {
  let searches = 0;
  let active = 0;
  let maxActive = 0;
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<void>(resolve => { started = resolve; });
  const route = createArenaLookupRoute(async input => {
    if (new URL(input).pathname === '/v2/search') {
      searches++;
      return Response.json({ blocks: Array.from({ length: 8 }, (_, index) => block(index + 1)), total_pages: 1 });
    }
    active++;
    maxActive = Math.max(active, maxActive);
    if (active === 3) started();
    await gate;
    active--;
    return Response.json({ channels: [channel('shared')], total_pages: 1 });
  });
  const pending = [route(request()), route(request())];
  await ready;
  expect(active).toBe(3);
  release();
  for (const response of await Promise.all(pending)) expect((await response.json()).blocks).toHaveLength(8);
  expect(searches).toBe(1);
  expect(maxActive).toBe(3);
});

test('rejects invalid inputs before network access and preserves upstream rate limits without leaking errors', async () => {
  let calls = 0;
  const route = createArenaLookupRoute(async () => {
    calls++;
    return new Response('private upstream diagnostics', { status: 429, headers: { 'Retry-After': '11' } });
  });
  for (const input of ['file:///tmp/article', 'https://user:password@example.com/', 'https://localhost/', 'not a url']) expect((await route(request(input))).status).toBe(400);
  for (const page of [0, -1, 1.5, Infinity]) expect((await route(request(target, page))).status).toBe(400);
  expect(calls).toBe(0);
  const response = await route(request());
  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('11');
  expect(await response.text()).not.toContain('private upstream');
  expect((await route(request())).status).toBe(429);
  expect(calls).toBe(2);
});

test('bounds upstream bodies and rejects malformed search data without treating failures as empty results', async () => {
  for (const body of [JSON.stringify({ channels: [] }), '[1,2,3]', 'invalid JSON', JSON.stringify({ blocks: [], padding: 'x'.repeat(3 * 1024 * 1024) })]) {
    const route = createArenaLookupRoute(async () => new Response(body));
    expect((await route(request())).status).toBe(502);
  }
});
