import { storedPageHeaders } from '@/src/lib/reader-csp';

/**
 * Stored pages: reliable, not permanent.
 *
 * The first reader of a page waits for the API to capture and clean it. That
 * cleaned copy is kept in Cloudflare KV, and every later reader is served from
 * there without the API being involved.
 *
 * - One copy per page, no versions. A newer capture replaces the older one.
 * - A copy is refreshed at most weekly, and only because someone read it. The
 *   reader is served the copy on hand; the refresh happens behind them.
 * - A copy is replaced only by a capture that succeeded. A failed capture is
 *   never stored, and a failed refresh keeps the copy and tries again a day later.
 * - A copy nobody reads expires about 90 days after its last write, which is
 *   at most a week after it was last read (KV expiry does the forgetting).
 * - When storage passes its budget, the least recently read copies go first.
 * - Every response is marked noindex and links to the original.
 *
 * This runs in a Pages Function, and in tests with a Map-backed store.
 */

/** The part of Cloudflare's KVNamespace this uses. */
export interface PageStore {
  get(key: string): Promise<string | null>;
  getWithMetadata(key: string): Promise<{ value: string | null; metadata: unknown }>;
  put(key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string; cursor?: string }): Promise<{
    keys: Array<{ name: string; metadata?: unknown }>; list_complete: boolean; cursor?: string;
  }>;
}

export interface StoredPagesEnv {
  /** KV namespace binding. Without it every read goes to the API, as before. */
  PAGES?: PageStore;
  /** The capture API. Defaults to production. */
  API_ORIGIN?: string;
  /** Shared with the API so it trusts the visitor address sent with a capture. */
  EDGE_KEY?: string;
  /** Storage budget in bytes. Defaults to 800 MB of the free plan's 1 GB. */
  PAGES_MAX_BYTES?: string;
}

interface CopyMetadata {
  capturedAt: number;
  /** Earliest time a read may trigger a refresh. */
  checkAt: number;
  /** Last write, which a read caused. Orders eviction. */
  touchedAt: number;
  bytes: number;
}

const DAY = 24 * 60 * 60 * 1000;
export const REFRESH_AFTER = 7 * DAY;
export const RETRY_FAILED_REFRESH_AFTER = DAY;
export const FORGET_UNREAD_AFTER = 90 * DAY;
const SWEEP_EVERY = DAY;
const DEFAULT_MAX_BYTES = 800 * 1024 * 1024;
/** KV values stop at 25 MiB; a cleaned page is far smaller. Larger ones are served, not kept. */
const MAX_COPY_BYTES = 10 * 1024 * 1024;
const PREFIX = 'page:v1:';
const SWEEP_MARKER = 'sweep:v1';

interface Dependencies {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  now: () => number;
}

function isMetadata(value: unknown): value is CopyMetadata {
  if (!value || typeof value !== 'object') return false;
  const meta = value as Record<string, unknown>;
  return ['capturedAt', 'checkAt', 'touchedAt', 'bytes'].every(key => Number.isFinite(meta[key]));
}

/** The API's success shape, checked before a response may become the stored copy. */
function isCleanedPage(body: string): boolean {
  try {
    const page = JSON.parse(body) as Record<string, unknown>;
    return typeof page.html === 'string' && typeof page.textContent === 'string';
  } catch { return false; }
}

async function storeKey(url: string): Promise<string> {
  // KV keys stop at 512 bytes and URLs do not.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url));
  return PREFIX + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Storage is full: forget the least recently read copies, at most once a day. */
async function forgetLeastRecentlyRead(store: PageStore, maxBytes: number): Promise<void> {
  if (await store.get(SWEEP_MARKER)) return;
  await store.put(SWEEP_MARKER, '1', { expirationTtl: SWEEP_EVERY / 1000 });
  const copies: Array<{ name: string; touchedAt: number; bytes: number }> = [];
  let cursor: string | undefined;
  do {
    const page = await store.list({ prefix: PREFIX, cursor });
    for (const key of page.keys) {
      // A copy without readable metadata sorts first: it cannot be refreshed either.
      const meta = isMetadata(key.metadata) ? key.metadata : { touchedAt: 0, bytes: 0 };
      copies.push({ name: key.name, touchedAt: meta.touchedAt, bytes: meta.bytes });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  let total = copies.reduce((sum, copy) => sum + copy.bytes, 0);
  if (total <= maxBytes) return;
  copies.sort((a, b) => a.touchedAt - b.touchedAt);
  // Leave headroom so the next capture does not land on a full store again.
  // A Worker invocation may make 1,000 KV calls; stay well inside that.
  for (const copy of copies.slice(0, 500)) {
    if (total <= maxBytes * 0.9) break;
    await store.delete(copy.name);
    total -= copy.bytes;
  }
}

export async function servePage(
  request: Request, env: StoredPagesEnv, waitUntil: (work: Promise<unknown>) => void,
  { fetch: send = (url, init) => fetch(url, init), now = Date.now }: Partial<Dependencies> = {},
): Promise<Response> {
  const api = env.API_ORIGIN || 'https://api.henry.ink';
  const requested = new URL(request.url).searchParams.get('url') || '';
  let source: string | undefined;
  try {
    const parsed = new URL(requested);
    parsed.hash = '';
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') source = parsed.href;
  } catch { /* The API explains what is wrong with the address. */ }

  const capture = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    const visitor = request.headers.get('CF-Connecting-IP');
    // The API limits first-time captures per visitor, so it must hear who is
    // asking; it believes this header only alongside the shared key.
    if (visitor && env.EDGE_KEY) {
      headers['X-Henry-Visitor'] = visitor;
      headers['X-Henry-Edge-Key'] = env.EDGE_KEY;
    }
    try {
      return await send(`${api}/api/archive?${new URLSearchParams({ url: requested })}`, { headers });
    } catch {
      // The API is unreachable. Stored pages are unaffected; a new one has to wait.
      return Response.json({ error: 'The article service is unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
  };
  const respond = (body: string, copy: 'stored' | 'captured', capturedAt: number) => new Response(body, {
    headers: {
      ...storedPageHeaders(api, source!),
      'X-Page-Copy': copy,
      'X-Page-Captured': new Date(capturedAt).toISOString(),
    },
  });
  /** Errors and anything unstorable pass through untouched, including Retry-After. */
  const passThrough = (response: Response) => {
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Expose-Headers', 'Retry-After');
    headers.set('X-Robots-Tag', 'noindex');
    return new Response(response.body, { status: response.status, headers });
  };

  const store = env.PAGES;
  if (!store || !source) return passThrough(await capture());
  const key = await storeKey(source);
  const save = (body: string, meta: CopyMetadata) =>
    store.put(key, body, { expirationTtl: FORGET_UNREAD_AFTER / 1000, metadata: meta });

  let kept: { value: string | null; metadata: unknown } = { value: null, metadata: null };
  // A storage outage must not stop reading: fall back to the API.
  try { kept = await store.getWithMetadata(key); } catch { /* Treated as a miss. */ }

  if (kept.value !== null && isMetadata(kept.metadata)) {
    const body = kept.value;
    const meta = kept.metadata;
    if (now() >= meta.checkAt) {
      waitUntil((async () => {
        let fresh: string | undefined;
        try {
          const response = await capture();
          const text = await response.text();
          if (response.ok && isCleanedPage(text) && byteLength(text) <= MAX_COPY_BYTES) fresh = text;
        } catch { /* The copy on hand stays. */ }
        const at = now();
        await (fresh === undefined
          ? save(body, { ...meta, checkAt: at + RETRY_FAILED_REFRESH_AFTER, touchedAt: at })
          : save(fresh, { capturedAt: at, checkAt: at + REFRESH_AFTER, touchedAt: at, bytes: byteLength(fresh) }));
      })().catch(() => {}));
    }
    return respond(body, 'stored', meta.capturedAt);
  }

  const response = await capture();
  if (!response.ok) return passThrough(response);
  const body = await response.text();
  const at = now();
  // A 200 that is not a cleaned page (an intermediary's error page, say) is a failure.
  if (!isCleanedPage(body)) {
    return passThrough(Response.json({ error: 'Upstream fetch failed' }, { status: 502, headers: { 'Cache-Control': 'no-store' } }));
  }
  const bytes = byteLength(body);
  if (bytes <= MAX_COPY_BYTES) {
    waitUntil((async () => {
      await save(body, { capturedAt: at, checkAt: at + REFRESH_AFTER, touchedAt: at, bytes });
      await forgetLeastRecentlyRead(store, Number(env.PAGES_MAX_BYTES) || DEFAULT_MAX_BYTES);
    })().catch(() => {}));
  }
  return respond(body, 'captured', at);
}
