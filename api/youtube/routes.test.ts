import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test';
import { youtubeTranscriptRoute } from '@/api/youtube/routes';
import { CAPTIONS_MAX_BYTES, REQUEST_TIMEOUT_MS, WATCH_MAX_BYTES, type Fetcher } from '@/api/youtube/upstream';

const captionUrl = 'https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=en';
const captions = {
  playerCaptionsTracklistRenderer: {
    captionTracks: [{ baseUrl: captionUrl, languageCode: 'en' }],
  },
};
const watchHtml = `<meta property="og:title" content="Fixture - YouTube"><script>{"captions":${JSON.stringify(captions)},"videoDetails":{}}</script>`;
const transcriptXml = '<transcript><text start="1.5" dur="2.5">Tom &amp; Jerry&#39;s</text></transcript>';
const request = (videoId: string, lang = 'en') => new Request(
  `https://api.henry.ink/api/youtube/transcript?${new URLSearchParams({ videoId, lang })}`,
  { headers: { Origin: 'https://henry.ink' } },
);
const restores: (() => void)[] = [];
beforeEach(() => {
  const logger = spyOn(console, 'error').mockImplementation(() => {});
  restores.push(() => logger.mockRestore());
});
afterEach(() => { for (const restore of restores.splice(0).reverse()) restore(); });
let serial = 0;
const nextId = () => `test${String(++serial).padStart(7, '0')}`;

function upstream(fallback = false, override?: (url: string, options: RequestInit, call: number) => Response | undefined) {
  const calls: string[] = [];
  const options: RequestInit[] = [];
  let captionCalls = 0;
  const fetcher: Fetcher = async (url, init) => {
    calls.push(url);
    options.push(init);
    const replacement = override?.(url, init, calls.length);
    if (replacement) return replacement;
    if (url.startsWith('https://www.youtube.com/watch?')) return new Response(watchHtml);
    if (url === 'https://www.youtube.com/youtubei/v1/player') return Response.json({ captions });
    if (url === captionUrl) return new Response(fallback && ++captionCalls === 1 ? '' : transcriptXml);
    throw new Error(`Unexpected upstream: ${url}`);
  };
  return { calls, options, fetcher };
}

test('cold transcript network count and response contract', async () => {
  const { calls, fetcher } = upstream();
  const response = await youtubeTranscriptRoute(request('abcdefghijk'), fetcher);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    videoId: 'abcdefghijk', title: 'Fixture',
    transcript: [{ text: "Tom & Jerry's", offset: 1.5, duration: 2.5, lang: 'en' }],
  });
  expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
  expect(response.headers.get('access-control-allow-origin')).toBe('https://henry.ink');
  expect(calls).toHaveLength(2);
  expect(calls.filter(url => url.includes('/watch?'))).toHaveLength(1);
  expect((await youtubeTranscriptRoute(request('abcdefghijk'), fetcher)).status).toBe(200);
  expect(calls).toHaveLength(2);
});

test('empty captions fallback network count', async () => {
  const { calls, fetcher } = upstream(true);
  const response = await youtubeTranscriptRoute(request('fallback_01'), fetcher);
  expect(response.status).toBe(200);
  expect((await response.json()).title).toBe('Fixture');
  expect(calls).toHaveLength(4);
  expect(calls.filter(url => url.includes('/watch?'))).toHaveLength(1);
});

test('supported URL forms share cached work but echo the supplied videoId', async () => {
  const id = nextId();
  const { calls, fetcher } = upstream();
  for (const input of [
    `https://www.youtube.com/watch?v=${id}&t=10`, id, `https://youtu.be/${id}?t=10`,
    `youtube.com/shorts/${id}`, `http://m.youtube.com/embed/${id}`, `https://music.youtube.com/watch?v=${id}`,
  ]) {
    const response = await youtubeTranscriptRoute(request(input), fetcher);
    expect(response.status).toBe(200);
    expect((await response.json()).videoId).toBe(input);
  }
  expect(calls).toEqual([`https://www.youtube.com/watch?v=${id}`, captionUrl]);
});

test('invalid IDs, hostile hosts and invalid languages never fetch', async () => {
  const { calls, fetcher } = upstream();
  for (const id of ['', 'a'.repeat(10), 'a'.repeat(12), 'abc&efghijk',
    'https://notyoutube.com/watch?v=abcdefghijk', 'https://youtube.com.evil.test/watch?v=abcdefghijk',
    'https://evil.test/youtube.com/watch?v=abcdefghijk', 'https://youtube.com@evil.test/watch?v=abcdefghijk',
    'https://user@youtube.com/watch?v=abcdefghijk', 'https://youtube.com:444/watch?v=abcdefghijk',
    'ftp://youtube.com/watch?v=abcdefghijk', 'https://youtu.be/abcdefghijkextra',
    'https://youtube.com/watch?v=abcdefghijkextra', 'x'.repeat(2049)]) {
    expect((await youtubeTranscriptRoute(request(id), fetcher)).status).toBe(400);
  }
  for (const lang of ['en\r\nCookie: private', 'en,fr', '../en', 'a'.repeat(65)]) {
    expect((await youtubeTranscriptRoute(request(nextId(), lang), fetcher)).status).toBe(400);
  }
  expect(calls).toHaveLength(0);
});

test('all stages block redirects, omit credentials and share one deadline signal', async () => {
  const { calls, options, fetcher } = upstream(true);
  const req = new Request(request(nextId()), { headers: { Authorization: 'secret', Cookie: 'secret' } });
  expect((await youtubeTranscriptRoute(req, fetcher)).status).toBe(200);
  expect(calls).toHaveLength(4);
  for (const init of options) {
    expect(init.redirect).toBe('error');
    expect(init.credentials).toBe('omit');
    expect(init.signal!).toBe(options[0].signal!);
    const headers = new Headers(init.headers);
    expect(headers.has('authorization')).toBe(false);
    expect(headers.has('cookie')).toBe(false);
    expect(headers.get('accept-language')).toBe('en');
  }
});

test('missing title stays optional without additional network work', async () => {
  const { calls, fetcher } = upstream(false, (_url, _options, call) => call === 1 ?
    new Response(watchHtml.replace(/<meta[^>]*>/, '')) : undefined);
  const response = await youtubeTranscriptRoute(request(nextId()), fetcher);
  expect(response.status).toBe(200);
  expect(await response.json()).not.toHaveProperty('title');
  expect(calls).toHaveLength(2);
});

test('unavailable and malformed captions stop after the watch request', async () => {
  for (const html of ['<div class="g-recaptcha">', '<html>Unavailable</html>',
    '"playabilityStatus":{}', '"captions":invalid,"videoDetails":{}',
    ...[null, {}, { captionTracks: [] }, { captionTracks: [null] },
      { captionTracks: [{ languageCode: 'fr', baseUrl: captionUrl }] },
    ].map(renderer => `"captions":${JSON.stringify({ playerCaptionsTracklistRenderer: renderer })},"videoDetails":{}`)]) {
    const { calls, fetcher } = upstream(false, () => new Response(html));
    const id = nextId();
    const response = await youtubeTranscriptRoute(request(id), fetcher);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ videoId: id, transcript: [], error: 'Failed to fetch transcript' });
    expect(response.headers.has('cache-control')).toBe(false);
    expect(calls).toHaveLength(1);
  }
});

test('unsafe caption destinations never reach the network', async () => {
  for (const destination of ['http://www.youtube.com/api/timedtext', 'https://127.0.0.1/api/timedtext',
    'https://www.youtube.com.evil.test/api/timedtext', 'https://www.youtube.com/redirect',
    'https://user@www.youtube.com/api/timedtext', 'https://www.youtube.com:444/api/timedtext',
    'file:///etc/passwd', 'not a URL']) {
    const { calls, fetcher } = upstream(false, (_url, _options, call) => call === 1 ?
      new Response(watchHtml.replace(captionUrl, destination)) : undefined);
    expect((await youtubeTranscriptRoute(request(nextId()), fetcher)).status).toBe(500);
    expect(calls).toHaveLength(1);
  }
});

test('upstream HTTP errors and redirects do not trigger retries or enter the cache', async () => {
  for (const status of [302, 403, 429, 503]) {
    for (const stage of [1, 2, 3, 4]) {
      const id = nextId();
      let cancelled = false;
      const bad = upstream(true, (_url, _options, call) => call === stage ? new Response(
        new ReadableStream({ cancel() { cancelled = true; } }), { status },
      ) : undefined);
      expect((await youtubeTranscriptRoute(request(id), bad.fetcher)).status).toBe(500);
      expect(cancelled).toBe(true);
      expect(bad.calls).toHaveLength(stage);
      const good = upstream();
      expect((await youtubeTranscriptRoute(request(id), good.fetcher)).status).toBe(200);
      expect(good.calls).toHaveLength(2);
    }
  }
});

test('both caption methods empty means failure after at most four requests', async () => {
  const { calls, fetcher } = upstream(false, url => url === captionUrl ? new Response('') : undefined);
  const id = nextId();
  expect((await youtubeTranscriptRoute(request(id), fetcher)).status).toBe(500);
  expect(calls).toHaveLength(4);
  const good = upstream();
  expect((await youtubeTranscriptRoute(request(id), good.fetcher)).status).toBe(200);
  expect(good.calls).toHaveLength(2);
});

test('invalid timing is a failure, not a cached transcript with null numbers', async () => {
  for (const value of ['NaN', 'Infinity', '-1', '', '1oops']) {
    const { calls, fetcher } = upstream(false, url => url === captionUrl ?
      new Response(`<text start="${value}" dur="2">Bad</text>`) : undefined);
    expect((await youtubeTranscriptRoute(request(nextId()), fetcher)).status).toBe(500);
    expect(calls).toHaveLength(2);
  }
});

test('every stage enforces declared and streamed decoded-byte limits and cancels', async () => {
  for (const stage of [1, 2, 3, 4]) {
    for (const declared of [true, false]) {
      let cancelled = false;
      const limit = stage === 1 ? WATCH_MAX_BYTES : CAPTIONS_MAX_BYTES;
      const { calls, fetcher } = upstream(true, (_url, _options, call) => {
        if (call !== stage) return undefined;
        return new Response(new ReadableStream({
          start(controller) { if (!declared) controller.enqueue(new Uint8Array(limit + 1)); },
          cancel() { cancelled = true; },
        }), { headers: declared ? { 'Content-Length': String(limit + 1) } : {} });
      });
      expect((await youtubeTranscriptRoute(request(nextId()), fetcher)).status).toBe(500);
      expect(calls).toHaveLength(stage);
      expect(cancelled).toBe(true);
    }
  }
});

test('caller cancellation stops a stalled body and never caches partial results', async () => {
  const controller = new AbortController();
  const id = nextId();
  let cancelled = false;
  const { calls, fetcher } = upstream(false, (_url, _options, call) => call === 2 ?
    new Response(new ReadableStream({
      pull() { controller.abort(); }, cancel() { cancelled = true; },
    }, { highWaterMark: 0 })) : undefined);
  const response = await youtubeTranscriptRoute(new Request(request(id), { signal: controller.signal }), fetcher);
  expect(response.status).toBe(500);
  expect(cancelled).toBe(true);
  expect(calls).toHaveLength(2);
  const good = upstream();
  expect((await youtubeTranscriptRoute(request(id), good.fetcher)).status).toBe(200);
  expect(good.calls).toHaveLength(2);
  const preAborted = await youtubeTranscriptRoute(new Request(request(nextId()), { signal: controller.signal }), good.fetcher);
  expect(preAborted.status).toBe(500);
  expect(good.calls).toHaveLength(2);
});

test('the shared 15-second deadline cancels a stalled body and is cleared', async () => {
  let expire: (() => void) | undefined;
  const nativeTimeout = globalThis.setTimeout;
  const timeout = spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void, delay: number) => {
    expect(delay).toBe(REQUEST_TIMEOUT_MS);
    expire = callback;
    return nativeTimeout(() => {}, 60_000);
  }) as typeof setTimeout);
  const clear = spyOn(globalThis, 'clearTimeout');
  restores.push(() => timeout.mockRestore(), () => clear.mockRestore());
  let cancelled = false;
  const { fetcher } = upstream(false, () => new Response(new ReadableStream({
    pull() { expire?.(); }, cancel() { cancelled = true; },
  }, { highWaterMark: 0 })));
  expect((await youtubeTranscriptRoute(request(nextId()), fetcher)).status).toBe(500);
  expect(cancelled).toBe(true);
  expect(timeout).toHaveBeenCalledTimes(1);
  expect(clear).toHaveBeenCalledTimes(1);
});

test('language cache keys are separate and expiry forces a new two-call capture', async () => {
  const id = nextId();
  const { calls, fetcher } = upstream();
  expect((await youtubeTranscriptRoute(request(id), fetcher)).status).toBe(200);
  const french = upstream(false, (_url, _options, call) => call === 1 ?
    new Response(watchHtml.replace('"languageCode":"en"', '"languageCode":"fr"')) : undefined);
  expect((await youtubeTranscriptRoute(request(id, 'fr'), french.fetcher)).status).toBe(200);
  expect(french.calls).toHaveLength(2);
  const now = Date.now();
  const clock = spyOn(Date, 'now').mockReturnValue(now + 60 * 60 * 1000 + 1);
  restores.push(() => clock.mockRestore());
  expect((await youtubeTranscriptRoute(request(id), fetcher)).status).toBe(200);
  expect(calls).toHaveLength(4);
});
