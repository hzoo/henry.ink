import { expect, test } from 'bun:test';
import type { ArchiveResponse } from '@/api/archive/routes';
import { createArchiveCache } from '@/henry-ink/reader/archive-cache';
import type { ReadableArticle } from '@/henry-ink/reader/readable';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const url = 'https://example.test/article';
const archive: ArchiveResponse = { html: '<p class="original">Article</p>', textContent: 'Article',
  css: 'p { color:red }', bodyAttrs: { bgcolor: 'red' }, htmlAttrs: { lang: 'en' }, resolvedUrl: url };
const readable: ReadableArticle = { html: '<p>Article</p>', textContent: 'Article' };
const signal = () => new AbortController().signal;

test('default transport fetches only the archive API once across mode switches, never Jina', async () => {
  const nativeFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = Object.assign(async (input: RequestInfo | URL) => {
    requests.push(String(input));
    return Response.json(archive);
  }, { preconnect: nativeFetch.preconnect });
  try {
    const cache = createArchiveCache({ extract: async () => readable });
    for (const mode of ['md', 'archive', 'md', 'archive'] as const) await cache.read(url, mode, signal());
    expect(requests).toHaveLength(1);
    const endpoint = new URL(requests[0]);
    expect(endpoint.pathname).toBe('/api/archive');
    expect(endpoint.searchParams.get('url')).toBe(url);
  } finally { globalThis.fetch = nativeFetch; }
});

test('both mode orders share one capture and one extraction; Original stays byte-identical', async () => {
  for (const order of [['archive', 'md'], ['md', 'archive']] as const) {
    let loads = 0;
    let extracts = 0;
    const cache = createArchiveCache({ load: async () => { loads++; return archive; },
      extract: async source => { extracts++; expect(source).toBe(archive); return readable; } });
    for (const mode of [...order, ...order]) {
      const result = await cache.read(url, mode, signal());
      if (mode === 'archive') expect(result).toBe(archive);
      else {
        expect(result.html).toBe(readable.html);
        expect(result.textContent).toBe('Article');
        expect(result.css).toBeUndefined();
        expect(result.bodyAttrs).toBeUndefined();
      }
    }
    expect(loads).toBe(1);
    expect(extracts).toBe(1);
  }
});

test('in-flight mode toggles adopt the same request and notify only live subscribers', async () => {
  const response = deferred<ArchiveResponse>();
  let loads = 0;
  let upstream!: AbortSignal;
  let retry!: () => void;
  const notices: string[] = [];
  const cache = createArchiveCache({ load: async (_, signal, onRetry) => {
    loads++; upstream = signal; retry = onRetry; return response.promise;
  }, extract: async () => readable });
  const first = new AbortController();
  const original = cache.read(url, 'archive', first.signal, () => notices.push('old'));
  first.abort();
  const text = cache.read(url, 'md', signal(), () => notices.push('new'));
  retry();
  expect(notices).toEqual(['new']);
  notices.length = 0;
  await expect(original).rejects.toMatchObject({ name: 'AbortError' });
  await tick();
  expect(upstream.aborted).toBe(false);
  retry();
  expect(notices).toEqual(['new']);
  response.resolve(archive);
  expect((await text).html).toBe(readable.html);
  expect(await cache.read(url, 'archive', signal())).toBe(archive);
  expect(loads).toBe(1);
});

test('cancelling one active subscriber does not cancel the other', async () => {
  const response = deferred<ArchiveResponse>();
  let upstream!: AbortSignal;
  const cache = createArchiveCache({ load: async (_, signal) => { upstream = signal; return response.promise; } });
  const first = new AbortController();
  const abandoned = cache.read(url, 'archive', first.signal);
  const live = cache.read(url, 'archive', signal());
  first.abort();
  await expect(abandoned).rejects.toMatchObject({ name: 'AbortError' });
  await tick();
  expect(upstream.aborted).toBe(false);
  response.resolve(archive);
  expect(await live).toBe(archive);
});

test('navigation aborts unused requests and late responses cannot populate cache', async () => {
  const response = deferred<ArchiveResponse>();
  let loads = 0;
  let upstream!: AbortSignal;
  const cache = createArchiveCache({ load: async (_, signal) => {
    upstream = signal; return ++loads === 1 ? response.promise : archive;
  } });
  const controller = new AbortController();
  const old = cache.read(url, 'archive', controller.signal);
  controller.abort();
  await expect(old).rejects.toMatchObject({ name: 'AbortError' });
  await tick();
  expect(upstream.aborted).toBe(true);
  response.resolve({ ...archive, textContent: 'Stale' });
  await tick();
  expect(await cache.read(url, 'archive', signal())).toBe(archive);
  expect(loads).toBe(2);
});

test('slow extraction is shared, cancellation rejects promptly, Original is not blocked', async () => {
  const result = deferred<ReadableArticle>();
  let extracts = 0;
  const cache = createArchiveCache({ load: async () => archive, extract: async () => { extracts++; return result.promise; } });
  const controller = new AbortController();
  const old = cache.read(url, 'md', controller.signal);
  await tick();
  controller.abort();
  await expect(old).rejects.toMatchObject({ name: 'AbortError' });
  expect(await cache.read(url, 'archive', signal())).toBe(archive);
  const next = cache.read(url, 'md', signal());
  result.resolve(readable);
  expect((await next).html).toBe(readable.html);
  expect(extracts).toBe(1);
});

test('LRU bound and 15-minute TTL evict captured and readable content together', async () => {
  let now = 0;
  let loads = 0;
  let extracts = 0;
  const cache = createArchiveCache({ limit: 2, now: () => now,
    load: async () => { loads++; return archive; }, extract: async () => { extracts++; return readable; } });
  for (const key of ['a', 'b', 'a', 'c', 'a']) await cache.read(key, 'md', signal());
  expect(loads).toBe(3);
  expect(extracts).toBe(3);
  await cache.read('b', 'md', signal());
  expect(loads).toBe(4);
  expect(extracts).toBe(4);
  now = 15 * 60 * 1000 - 1;
  await cache.read('b', 'archive', signal());
  expect(loads).toBe(4);
  now++;
  await cache.read('b', 'md', signal());
  expect(loads).toBe(5);
  expect(extracts).toBe(5);
});

test('failed captures and extraction can be retried without poisoning cache', async () => {
  let loads = 0;
  let extracts = 0;
  const cache = createArchiveCache({ load: async () => {
    if (++loads === 1) throw new Error('capture failed');
    return archive;
  }, extract: async () => { if (++extracts === 1) throw new Error('chunk failed'); return readable; } });
  await expect(cache.read(url, 'md', signal())).rejects.toThrow('capture failed');
  await expect(cache.read(url, 'md', signal())).rejects.toThrow('chunk failed');
  expect((await cache.read(url, 'md', signal())).html).toBe(readable.html);
  expect(loads).toBe(2);
  expect(extracts).toBe(2);
});
