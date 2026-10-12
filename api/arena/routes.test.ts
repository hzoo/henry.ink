import { afterAll, afterEach, beforeAll, expect, spyOn, test } from 'bun:test';
import { ChannelStorage } from '@/api/arena/channel-storage';
import { ChannelPatternMatcher } from '@/api/arena/pattern-matcher';

let routes: typeof import('@/api/arena/routes');
const restorers: Array<{ mockRestore(): void }> = [];

beforeAll(async () => {
  const previous = process.env.ARENA_DB_PATH;
  process.env.ARENA_DB_PATH = ':memory:';
  try {
    routes = await import('@/api/arena/routes');
  } finally {
    if (previous === undefined) delete process.env.ARENA_DB_PATH;
    else process.env.ARENA_DB_PATH = previous;
  }
});

afterEach(() => {
  for (const restorer of restorers.splice(0)) restorer.mockRestore();
});
afterAll(() => routes.closeArenaStorage());

function request(body: unknown) {
  return new Request('https://api.henry.ink/api/arena', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://henry.ink' },
    body: JSON.stringify(body),
  });
}

function upstream(body: unknown) {
  const fetcher = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(async () => Response.json(body), { preconnect: fetch.preconnect }),
  );
  restorers.push(fetcher);
  return fetcher;
}

function searchChannel(id: number, title: string, user: unknown = { username: 'Reader', slug: 'reader' }) {
  return {
    id, title, slug: `channel-${id}`, length: 10, status: 'public',
    created_at: '2026-01-01', updated_at: '2026-01-02', user,
  };
}

async function search(channel: ReturnType<typeof searchChannel>) {
  const fetcher = upstream({ channels: [channel] });
  const response = await routes.arenaSearchRoute(request({ query: channel.title }));
  expect(response.status).toBe(200);
  fetcher.mockRestore();
}

test('same URL and options cannot return matches for different content', async () => {
  await search(searchChannel(1, 'Cache Content'));
  const first = await routes.enhanceRoute(request({ url: 'https://example.com/content', content: 'Cache Content' }));
  expect((await first.json()).matches).toHaveLength(1);
  const second = await routes.enhanceRoute(request({ url: 'https://example.com/content', content: 'Nothing relevant' }));
  expect(second.headers.get('Access-Control-Allow-Origin')).toBe('https://henry.ink');
  expect((await second.json()).matches).toHaveLength(0);
});

test('search invalidates cached misses and changed channel metadata', async () => {
  const body = { url: 'https://example.com/search', content: 'New Discovery' };
  expect((await (await routes.enhanceRoute(request(body))).json()).matches).toHaveLength(0);
  await search(searchChannel(2, 'New Discovery'));
  expect((await (await routes.enhanceRoute(request(body))).json()).matches).toHaveLength(1);
  await search({ ...searchChannel(2, 'New Discovery'), length: 25 });
  expect((await (await routes.enhanceRoute(request(body))).json()).matches[0].contents_count).toBe(25);
});

test('identical searches do not reload patterns or rebuild the automaton', async () => {
  const channel = searchChannel(3, 'Repeat Search');
  await search(channel);
  const patterns = spyOn(ChannelStorage.prototype, 'getChannelPatterns');
  const builds = spyOn(ChannelPatternMatcher.prototype, 'buildFromPatterns');
  restorers.push(patterns, builds);
  for (let i = 0; i < 5; i++) await search(channel);
  console.log(`Repeated searches: pattern loads=${patterns.mock.calls.length}, builds=${builds.mock.calls.length}`);
  expect(patterns).toHaveBeenCalledTimes(0);
  expect(builds).toHaveBeenCalledTimes(0);
});

test('warm enhancement hits cache; uncached matching needs no per-match database reads', async () => {
  await search(searchChannel(4, 'Warm Content'));
  const matches = spyOn(ChannelPatternMatcher.prototype, 'findMatches');
  const lookups = spyOn(ChannelStorage.prototype, 'getChannelBySlug');
  restorers.push(matches, lookups);
  const body = { url: 'https://example.com/warm', content: 'Warm Content' };
  for (let i = 0; i < 5; i++) {
    expect((await (await routes.enhanceRoute(request(body))).json()).matches).toHaveLength(1);
  }
  console.log(`Five enhancements: matcher scans=${matches.mock.calls.length}, channel lookups=${lookups.mock.calls.length}`);
  expect(matches).toHaveBeenCalledTimes(1);
  expect(lookups).toHaveBeenCalledTimes(0);
});

test('channel blocks reuse author from the first response and refresh cached author', async () => {
  const channel = searchChannel(5, 'Author Enrichment', {});
  await search(channel);
  const body = { url: 'https://example.com/author', content: channel.title };
  await routes.enhanceRoute(request(body));
  const fetcher = upstream({ ...channel, user: { username: 'Updated', slug: 'updated' }, contents: [] });
  const response = await routes.channelBlocksRoute(request({ slug: channel.slug, per: 7, page: 2 }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ slug: channel.slug, blocks: [], user: { name: 'Updated', slug: 'updated' } });
  console.log(`Channel blocks upstream requests=${fetcher.mock.calls.length}`);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(String(fetcher.mock.calls[0][0])).toEndWith('?per=7&page=2');
  expect((await (await routes.enhanceRoute(request(body))).json()).matches[0].author_slug).toBe('updated');
});

test('removed channels do not survive the enhancement cache', async () => {
  const channel = searchChannel(6, 'Removed Channel');
  await search(channel);
  const body = { url: 'https://example.com/removed', content: channel.title };
  expect((await (await routes.enhanceRoute(request(body))).json()).matches).toHaveLength(1);
  upstream({});
  expect((await routes.channelBlocksRoute(request({ slug: channel.slug }))).status).toBe(404);
  expect((await (await routes.enhanceRoute(request(body))).json()).matches).toHaveLength(0);
});

test('options remain part of cache identity and requests without URLs still work', async () => {
  await search(searchChannel(7, 'Option Identity'));
  const body = { url: 'https://example.com/options', content: 'Option Identity' };
  expect((await (await routes.enhanceRoute(request(body))).json()).matches).toHaveLength(1);
  expect((await (await routes.enhanceRoute(request({ ...body, options: { maxLinksPerChannel: 0 } }))).json()).matches).toHaveLength(0);
  expect((await (await routes.enhanceRoute(request({ content: body.content }))).json()).matches).toHaveLength(1);
});

test('filtered-out search results do not rebuild patterns', async () => {
  const builds = spyOn(ChannelPatternMatcher.prototype, 'buildFromPatterns');
  restorers.push(builds);
  await search({ ...searchChannel(8, 'Filtered Channel'), length: 1 });
  expect(builds).toHaveBeenCalledTimes(0);
});

test('channel blocks without a local channel do not make an author lookup request', async () => {
  const fetcher = upstream({ ...searchChannel(9, 'Not Stored'), contents: [] });
  expect((await routes.channelBlocksRoute(request({ slug: 'channel-9' }))).status).toBe(200);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
