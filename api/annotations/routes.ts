import { decodeMarginTargets, httpTarget } from '@/src/lib/annotations/margin';
import { getCorsHeaders } from '@/api/cors';

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8000;
type Fetcher = (url: URL, options: RequestInit) => Promise<Response>;

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
  const abort = () => { void reader.cancel().catch(() => {}); };
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
    await reader.cancel();
    reader.releaseLock();
  }
}

export async function marginAnnotationsRoute(
  req: Request,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const headers = {
    ...getCorsHeaders(req.headers.get('Origin') ?? ''),
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const params = new URL(req.url).searchParams;
  const target = httpTarget(params.get('url'));
  const rawOffset = params.get('offset') ?? '0';
  const offset = Number(rawOffset);
  if (!target || !/^\d+$/.test(rawOffset) || !Number.isSafeInteger(offset) || offset > 10000) {
    return json({ error: 'Expected an HTTP(S) url and offset between 0 and 10000' }, 400);
  }
  // The target is only a query value. Never fetch it or follow upstream redirects.
  const upstream = new URL('https://margin.at/api/targets');
  upstream.searchParams.set('source', target);
  upstream.searchParams.set('limit', '50');
  upstream.searchParams.set('offset', String(offset));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const signal = AbortSignal.any([req.signal, controller.signal]);
  try {
    const response = await fetcher(upstream, {
      signal, redirect: 'error', credentials: 'omit', headers: { Accept: 'application/json' },
    });
    const result = decodeMarginTargets(await readJson(response, signal));
    return json({
      ...result, via: 'margin', target,
      // Margin merges two independently paginated indexes and filters hidden notes.
      // A short/empty page does not prove that discovery is complete.
      page: { offset, limit: 50, completeness: 'unknown' },
    });
  } catch {
    return json({ error: signal.aborted ? 'Annotation request timed out or cancelled' : 'Margin is unavailable' },
      signal.aborted ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
}
