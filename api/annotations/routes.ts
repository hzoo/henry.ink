import { decodeMarginTargets, httpTarget } from '@/src/lib/annotations/margin';
import { getCorsHeaders } from '@/api/cors';
import { RateLimiter } from '@/api/rate-limit';

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_INFLIGHT = 8;
type Fetcher = (url: URL, options: RequestInit) => Promise<Response>;
interface MarginJob {
  controller: AbortController;
  subscribers: number;
  promise: Promise<ReturnType<typeof decodeMarginTargets>>;
}

async function subscribe(job: MarginJob, signal: AbortSignal) {
  const listeners = new AbortController();
  try {
    signal.throwIfAborted();
    return await Promise.race([
      job.promise,
      new Promise<never>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true, signal: listeners.signal });
      }),
    ]);
  } finally {
    listeners.abort();
  }
}

async function readJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const mime = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (!response.ok || mime !== 'application/json') {
    await response.body?.cancel();
    throw new Error('Invalid upstream response');
  }
  if (Number(response.headers.get('content-length')) > MAX_BYTES || !response.body) {
    await response.body?.cancel();
    throw new Error('Upstream response too large or empty');
  }
  const reader = response.body.getReader();
  let cancellation: Promise<void> | undefined;
  const cancel = () => cancellation ??= reader.cancel();
  const abort = () => { void cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new Error('Upstream response too large');
      chunks.push(value);
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(buffer));
  } finally {
    signal.removeEventListener('abort', abort);
    // Repeated reader.cancel() calls can resolve before the first cleanup finishes.
    try { await cancel(); } finally { reader.releaseLock(); }
  }
}

export function createMarginAnnotationsHandler(
  fetcher: Fetcher = fetch,
  options: { limiter?: RateLimiter; timeoutMs?: number } = {},
) {
  const limiter = options.limiter ?? new RateLimiter(30, 5);
  const pending = new Map<string, MarginJob>();
  return async (req: Request): Promise<Response> => {
    const headers = {
      ...getCorsHeaders(req.headers.get('Origin') ?? ''),
      'Cache-Control': 'no-store',
      'Vary': 'Origin',
    };
    const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
    if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    if (req.signal.aborted) return json({ error: 'Annotation request timed out or cancelled' }, 504);
    const busy = () => Response.json({ error: 'Too many annotation requests' }, {
      status: 429, headers: { ...headers, 'Retry-After': '1' },
    });
    // The trusted reverse proxy must overwrite these client identity headers.
    const ip = req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
      || req.headers.get('CF-Connecting-IP') || 'unknown';
    if (!limiter.consume(ip)) return busy();
    const params = new URL(req.url).searchParams;
    const target = httpTarget(params.get('url'));
    const rawOffset = params.get('offset') ?? '0';
    const offset = Number(rawOffset);
    if (!target || !/^\d+$/.test(rawOffset) || !Number.isSafeInteger(offset) || offset > 10000) {
      return json({ error: 'Expected an HTTP(S) url and offset between 0 and 10000' }, 400);
    }
    const key = JSON.stringify([target, offset]);
    let job = pending.get(key);
    if (job?.controller.signal.aborted) return busy();
    if (!job) {
      if (pending.size >= MAX_INFLIGHT) return busy();
      // The target is only a query value. Never fetch it or follow upstream redirects.
      const upstream = new URL('https://margin.at/api/targets');
      upstream.searchParams.set('source', target);
      upstream.searchParams.set('limit', '50');
      upstream.searchParams.set('offset', String(offset));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);
      job = {
        controller,
        subscribers: 0,
        promise: Promise.resolve().then(async () => {
          controller.signal.throwIfAborted();
          const response = await fetcher(upstream, {
            signal: controller.signal, redirect: 'error', credentials: 'omit', headers: { Accept: 'application/json' },
          });
          return decodeMarginTargets(await readJson(response, controller.signal));
        }).finally(() => {
          clearTimeout(timer);
          pending.delete(key);
        }),
      };
      pending.set(key, job);
    }
    job.subscribers++;
    try {
      const result = await subscribe(job, req.signal);
      return json({
        ...result, via: 'margin', target,
        // Margin merges two independently paginated indexes and filters hidden notes.
        // A short/empty page does not prove that discovery is complete.
        page: { offset, limit: 50, completeness: 'unknown' },
      });
    } catch {
      const cancelled = req.signal.aborted || job.controller.signal.aborted;
      return json({ error: cancelled ? 'Annotation request timed out or cancelled' : 'Margin is unavailable' },
        cancelled ? 504 : 502);
    } finally {
      // Keep aborted jobs counted until their transport/body has actually settled.
      if (--job.subscribers === 0 && pending.get(key) === job) job.controller.abort();
    }
  };
}

export const marginAnnotationsRoute = createMarginAnnotationsHandler();
