import { getCorsHeaders } from '@/api/cors';
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
 * - A copy expires 90 days after its last write (KV expiry does the
 *   forgetting). Reads cause a write at most weekly, so an unread copy goes
 *   between about 83 and 90 days after its last read.
 * - A page whose address looks like it carries a credential is served but not kept.
 * - When storage passes its budget, the least recently read copies go first.
 * - Every response is marked noindex and links to the original.
 * - One body for everyone; only the CORS headers are chosen per request,
 *   from the same origin allowlist the API uses.
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
/** A cleaned page is usually a few hundred KB. Larger ones are served, not kept, so a few fat pages cannot fill the store. */
const MAX_COPY_BYTES = 4 * 1024 * 1024;
/** Query names that usually make an address a private capability rather than a public page. */
const CREDENTIAL_PARAM = /^(?:token|access_token|id_token|auth|authorization|sig|signature|key|api_?key|secret|password|code|x-amz-.+|x-goog-.+)$/i;
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

/**
 * Whether a 200 from the API is a cleaned page, not an intermediary's error
 * page. The API writes `html` first; checking that is enough, and parsing
 * megabytes of JSON here would spend the Function's small CPU allowance.
 */
function isCleanedPage(response: Response, body: string): boolean {
  return response.ok && (response.headers.get('Content-Type') || '').includes('application/json')
    && body.startsWith('{"html":"');
}

export async function storeKey(url: string): Promise<string> {
  const parsed = new URL(url);
  parsed.hash = '';
  return hashedKey(parsed.href);
}

async function hashedKey(url: string): Promise<string> {
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
  const cors = getCorsHeaders(request.headers.get('Origin') || '');
  const requested = new URL(request.url).searchParams.get('url') || '';
  let source: string | undefined;
  try {
    const parsed = new URL(requested);
    parsed.hash = '';
    const capability = parsed.username || parsed.password
      || [...parsed.searchParams.keys()].some(name => CREDENTIAL_PARAM.test(name));
    if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && !capability) source = parsed.href;
  } catch { /* The API explains what is wrong with the address. */ }

  const capture = async (): Promise<Response> => {
    // The API cannot tell readers apart here and limits these requests as one
    // visitor. A reader told "busy" asks the API directly (see requestKeptArchive).
    try {
      return await send(`${api}/api/archive?${new URLSearchParams({ url: requested })}`, {});
    } catch {
      // The API is unreachable. Stored pages are unaffected; a new one has to wait.
      return Response.json({ error: 'The article service is unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
  };
  const respond = (body: string, copy: 'stored' | 'captured', capturedAt: number) => new Response(body, {
    headers: {
      ...storedPageHeaders(api, source!),
      ...cors,
      'X-Page-Copy': copy,
      'X-Page-Captured': new Date(capturedAt).toISOString(),
    },
  });
  /** Errors and anything unstorable pass through untouched, including Retry-After. */
  const passThrough = (response: Response) => {
    const headers = new Headers(response.headers);
    // The API answered the Function, not the reader: its CORS headers are replaced.
    for (const name of [...headers.keys()]) if (name.toLowerCase().startsWith('access-control-')) headers.delete(name);
    for (const [name, value] of Object.entries(cors)) headers.set(name, value);
    headers.set('X-Robots-Tag', 'noindex');
    return new Response(response.body, { status: response.status, headers });
  };

  const store = env.PAGES;
  if (!store || !source) return passThrough(await capture());
  const key = await hashedKey(source);
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
        let fresh: { body: string; bytes: number } | undefined;
        try {
          const response = await capture();
          const text = await response.text();
          const bytes = byteLength(text);
          if (isCleanedPage(response, text) && bytes <= MAX_COPY_BYTES) fresh = { body: text, bytes };
        } catch { /* The copy on hand stays. */ }
        const at = now();
        await (fresh === undefined
          ? save(body, { ...meta, checkAt: at + RETRY_FAILED_REFRESH_AFTER, touchedAt: at })
          : save(fresh.body, { capturedAt: at, checkAt: at + REFRESH_AFTER, touchedAt: at, bytes: fresh.bytes }));
      })().catch(() => {}));
    }
    return respond(body, 'stored', meta.capturedAt);
  }

  const response = await capture();
  if (!response.ok) return passThrough(response);
  let body = '';
  try { body = await response.text(); } catch { /* A connection lost mid-body is a failed capture. */ }
  const at = now();
  // A 200 that is not a cleaned page (an intermediary's error page, say) is a failure.
  if (!isCleanedPage(response, body)) {
    return passThrough(Response.json({ error: 'Upstream fetch failed' }, { status: 502, headers: { 'Cache-Control': 'no-store' } }));
  }
  const bytes = byteLength(body);
  if (bytes <= MAX_COPY_BYTES) {
    waitUntil((async () => {
      // Make room even when this save failed: a full store is exactly when it must run.
      try { await save(body, { capturedAt: at, checkAt: at + REFRESH_AFTER, touchedAt: at, bytes }); }
      finally { await forgetLeastRecentlyRead(store, Number(env.PAGES_MAX_BYTES) || DEFAULT_MAX_BYTES); }
    })().catch(() => {}));
  }
  return respond(body, 'captured', at);
}
