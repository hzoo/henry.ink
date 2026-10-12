import { afterEach, expect, test } from 'bun:test';
import { createMarginAnnotationsHandler } from '@/api/annotations/routes';
import { RateLimiter } from '@/api/rate-limit';

const limiters: RateLimiter[] = [];
afterEach(() => { for (const limiter of limiters.splice(0)) limiter.close(); });
function handler(fetcher: Parameters<typeof createMarginAnnotationsHandler>[0], timeoutMs?: number) {
  const limiter = new RateLimiter(30, 5);
  limiters.push(limiter);
  return createMarginAnnotationsHandler(fetcher, { limiter, timeoutMs });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const payload = { annotations: [], highlights: [], bookmarks: [] };
function request(ip: string, target = 'https://example.com/article', offset = '0', signal?: AbortSignal, origin = 'https://henry.ink') {
  return new Request(`https://api.henry.ink/api/annotations/margin?${new URLSearchParams({ url: target, offset })}`, {
    signal, headers: { 'X-Forwarded-For': ip, Origin: origin, Authorization: 'Bearer private', Cookie: 'private=1' },
  });
}
const settle = () => Bun.sleep(0);

test('100 identical readers share one job, independent responses, and no completed cache', async () => {
  let calls = 0;
  const gate = deferred<void>();
  const route = handler(async (url, options) => {
    calls++;
    expect(url.origin).toBe('https://margin.at');
    expect(options.redirect).toBe('error');
    expect(options.credentials).toBe('omit');
    expect(options.headers).toEqual({ Accept: 'application/json' });
    await gate.promise;
    return Response.json(payload);
  });
  const jobs = Array.from({ length: 100 }, (_, i) => route(request(`reader-${i}`, undefined, undefined, undefined,
    i % 2 ? 'https://untrusted.example' : 'https://henry.ink')));
  await settle();
  expect(calls).toBe(1);
  gate.resolve();
  const responses = await Promise.all(jobs);
  for (const [i, response] of responses.entries()) {
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(i % 2 ? null : 'https://henry.ink');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('vary')).toBe('Origin');
    expect(await response.json()).toMatchObject({ items: [], target: 'https://example.com/article',
      via: 'margin', page: { offset: 0, limit: 50, completeness: 'unknown' } });
  }
  expect((await route(request('later-reader'))).status).toBe(200);
  expect(calls).toBe(2);
});

test('100 distinct requests admit at most eight jobs, while existing jobs can still be joined', async () => {
  let active = 0;
  let peak = 0;
  let calls = 0;
  const gate = deferred<void>();
  const route = handler(async () => {
    calls++;
    peak = Math.max(peak, ++active);
    await gate.promise;
    active--;
    return Response.json(payload);
  });
  const jobs = Array.from({ length: 100 }, (_, i) => route(request(`reader-${i}`, `https://example.com/${i}`)));
  await settle();
  expect(calls).toBe(8);
  expect(peak).toBe(8);
  const joined = route(request('joining-reader', 'https://example.com/0'));
  gate.resolve();
  const responses = await Promise.all(jobs);
  expect(responses.filter(response => response.status === 200)).toHaveLength(8);
  expect(responses.filter(response => response.status === 429)).toHaveLength(92);
  expect(responses[99].headers.get('retry-after')).toBe('1');
  expect(responses[99].headers.get('cache-control')).toBe('no-store');
  expect(responses[99].headers.get('access-control-expose-headers')).toContain('Retry-After');
  expect((await joined).status).toBe(200);
  expect((await route(request('later-reader', 'https://example.com/new'))).status).toBe(200);
  expect(calls).toBe(9);
});

test('coalesced readers still spend the per-client budget', async () => {
  let calls = 0;
  const gate = deferred<void>();
  const route = handler(async () => { calls++; await gate.promise; return Response.json(payload); });
  const jobs = Array.from({ length: 100 }, () => route(request('same-client')));
  await settle();
  expect(calls).toBe(1);
  gate.resolve();
  const responses = await Promise.all(jobs);
  expect(responses.filter(response => response.status === 200)).toHaveLength(30);
  expect(responses.filter(response => response.status === 429)).toHaveLength(70);
  expect((await route(request('different-client'))).status).toBe(200);
});

test('keys preserve the exact target and separate offsets without normalizing source URLs', async () => {
  const calls: string[][] = [];
  const gate = deferred<void>();
  const route = handler(async url => {
    calls.push([url.searchParams.get('source')!, url.searchParams.get('offset')!]);
    await gate.promise;
    return Response.json(payload);
  });
  const inputs = [
    ['https://example.com', '0'], ['https://example.com/', '0'],
    ['https://example.com/#note', '0'], ['https://example.com', '50'],
  ];
  const jobs = inputs.map(([target, offset], i) => route(request(`reader-${i}`, target, offset)));
  jobs.push(route(request('same-offset', 'https://example.com', '00')));
  await settle();
  expect(calls).toEqual(inputs);
  gate.resolve();
  expect((await Promise.all(jobs)).every(response => response.status === 200)).toBe(true);
});

test('cancelling the first subscriber leaves the other subscriber and body alive', async () => {
  let upstreamSignal!: AbortSignal;
  let body!: ReadableStreamDefaultController<Uint8Array>;
  let cancelled = false;
  const route = handler(async (_url, options) => {
    upstreamSignal = options.signal!;
    return new Response(new ReadableStream<Uint8Array>({
      start(controller) { body = controller; }, cancel() { cancelled = true; },
    }), { headers: { 'Content-Type': 'application/json' } });
  });
  const firstController = new AbortController();
  const first = route(request('first', undefined, undefined, firstController.signal));
  const second = route(request('second'));
  await settle();
  firstController.abort();
  expect((await first).status).toBe(504);
  expect(upstreamSignal.aborted).toBe(false);
  expect(cancelled).toBe(false);
  body.enqueue(new TextEncoder().encode(JSON.stringify(payload)));
  body.close();
  expect((await second).status).toBe(200);
});

test('all cancelled subscribers abort transport but retain slots until transport cleanup', async () => {
  const transports: Array<ReturnType<typeof deferred<Response>>> = [];
  const signals: AbortSignal[] = [];
  let stalled = true;
  const route = handler(async (_url, options) => {
    if (!stalled) return Response.json(payload);
    signals.push(options.signal!);
    const transport = deferred<Response>();
    transports.push(transport);
    return transport.promise;
  });
  const controllers = Array.from({ length: 8 }, () => new AbortController());
  const jobs = controllers.map((controller, i) => route(request(`reader-${i}`, `https://example.com/${i}`, '0', controller.signal)));
  await settle();
  controllers.forEach(controller => controller.abort());
  expect((await Promise.all(jobs)).every(response => response.status === 504)).toBe(true);
  expect(signals.every(signal => signal.aborted)).toBe(true);
  expect((await route(request('too-early', 'https://example.com/new'))).status).toBe(429);
  for (const transport of transports) transport.reject(new Error('abort cleanup completed'));
  await settle();
  stalled = false;
  expect((await route(request('retry-original', 'https://example.com/0'))).status).toBe(200);
  expect((await route(request('retry-new', 'https://example.com/new'))).status).toBe(200);
});

test('already-cancelled requests neither start jobs nor consume admission', async () => {
  let calls = 0;
  const route = handler(async () => { calls++; return Response.json(payload); });
  const controller = new AbortController();
  controller.abort();
  for (let i = 0; i < 100; i++) expect((await route(request('reader', undefined, undefined, controller.signal))).status).toBe(504);
  expect(calls).toBe(0);
  expect((await route(request('reader'))).status).toBe(200);
});

test('eight cancelled bodies retain every slot until their original cancellation cleanup settles', async () => {
  for (const rejectCleanup of [false, true]) {
    const cleanups = Array.from({ length: 8 }, () => deferred<void>());
    let calls = 0;
    let cancellations = 0;
    let stalled = true;
    const route = handler(async () => {
      const index = calls++;
      if (!stalled) return Response.json(payload);
      return new Response(new ReadableStream({
        cancel() { cancellations++; return cleanups[index].promise; },
      }), { headers: { 'Content-Type': 'application/json' } });
    });
    const controllers = Array.from({ length: 8 }, () => new AbortController());
    const jobs = controllers.map((controller, i) => route(request(`reader-${i}`, `https://example.com/${i}`, '0', controller.signal)));
    try {
      await settle();
      expect(calls).toBe(8);
      controllers.forEach(controller => controller.abort());
      expect((await Promise.all(jobs)).every(response => response.status === 504)).toBe(true);
      await settle();
      expect(cancellations).toBe(8);
      expect((await route(request('ninth', 'https://example.com/new'))).status).toBe(429);
      expect(calls).toBe(8);
    } finally {
      controllers.forEach(controller => controller.abort());
      for (const cleanup of cleanups) {
        if (rejectCleanup) cleanup.reject(new Error('Body cleanup failed'));
        else cleanup.resolve();
      }
      await Promise.all(jobs);
      await settle();
    }
    stalled = false;
    expect((await route(request('retry', 'https://example.com/new'))).status).toBe(200);
    expect(calls).toBe(9);
  }
});

test('shared failures release their key and every global slot for retries', async () => {
  const gate = deferred<void>();
  let fail = true;
  let calls = 0;
  const route = handler(async () => {
    calls++;
    await gate.promise;
    if (fail) throw new Error('upstream failed');
    return Response.json(payload);
  });
  const jobs = Array.from({ length: 8 }, (_, i) => route(request(`reader-${i}`, `https://example.com/${i}`)));
  jobs.push(route(request('duplicate', 'https://example.com/0')));
  gate.resolve();
  expect((await Promise.all(jobs)).every(response => response.status === 502)).toBe(true);
  expect(calls).toBe(8);
  fail = false;
  const retries = await Promise.all(Array.from({ length: 8 }, (_, i) => route(request(`retry-${i}`, `https://example.com/${i}`))));
  expect(retries.every(response => response.status === 200)).toBe(true);
  expect(calls).toBe(16);
});

test('shared body timeouts cancel reading, release slots, and permit a fresh retry', async () => {
  let cancelled = 0;
  let stalled = true;
  const route = handler(async () => stalled
    ? new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { 'Content-Type': 'application/json' } })
    : Response.json(payload), 20);
  const jobs = Array.from({ length: 8 }, (_, i) => route(request(`reader-${i}`, `https://example.com/${i}`)));
  jobs.push(route(request('duplicate', 'https://example.com/0')));
  expect((await Promise.all(jobs)).every(response => response.status === 504)).toBe(true);
  expect(cancelled).toBe(8);
  stalled = false;
  expect((await route(request('retry', 'https://example.com/0'))).status).toBe(200);
});

test('invalid MIME, JSON, schema, and oversized bodies release shared jobs for retry', async () => {
  for (const invalid of [
    () => new Response('html', { headers: { 'Content-Type': 'text/html' } }),
    () => new Response('{broken', { headers: { 'Content-Type': 'application/json' } }),
    () => Response.json({ changed: 'schema' }),
    () => new Response('x'.repeat(2 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } }),
  ]) {
    let fail = true;
    let calls = 0;
    const route = handler(async () => { calls++; return fail ? invalid() : Response.json(payload); });
    const responses = await Promise.all([route(request('first')), route(request('second'))]);
    expect(responses.map(response => response.status)).toEqual([502, 502]);
    expect(calls).toBe(1);
    fail = false;
    expect((await route(request('retry'))).status).toBe(200);
    expect(calls).toBe(2);
  }
});
