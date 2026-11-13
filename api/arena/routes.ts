import { getCorsHeaders } from '@/api/cors';
import { SnapshotCache } from '@/api/archive/snapshot-cache';
import { ArchiveFetchError } from '@/api/archive/public-fetch';
import { validateArchiveUrl } from '@/api/archive/url-validation';
import type { ArenaChannel, ArenaLookupPage, ArenaPerson, ArenaUrlBlock } from '@/src/lib/arena-types';

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
type JsonObject = Record<string, unknown>;
const PAGE_SIZE = 12;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

class UpstreamError extends Error {
  constructor(readonly status: number, readonly retryAfter: string | null = null) {
    super(`Are.na returned ${status}`);
  }
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function pageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}

const text = (value: unknown, limit = 2000): string | undefined =>
  typeof value === 'string' ? value.trim().slice(0, limit) || undefined : undefined;

function person(value: unknown): ArenaPerson | undefined {
  const item = object(value);
  const slug = text(item.slug, 256);
  const name = text(item.name || item.full_name || item.username, 160);
  return slug && name ? { slug, name } : undefined;
}

function preview(value: unknown): string | undefined {
  const image = object(value);
  for (const size of ['thumb', 'display', 'square']) {
    const url = pageUrl(object(image[size]).url);
    if (!url) continue;
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && !parsed.port &&
        ['images.are.na', 'd2w9rnfcy7mm78.cloudfront.net'].includes(parsed.hostname)) return url;
  }
}

async function arenaJson(path: string, signal: AbortSignal, fetcher: Fetcher): Promise<JsonObject> {
  const response = await fetcher(`https://api.are.na/v2/${path}`, {
    signal, redirect: 'error',
    headers: { Accept: 'application/json', 'User-Agent': 'HenryInk/0.0.11 (+https://henry.ink)' },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new UpstreamError(response.status, response.headers.get('Retry-After'));
  }
  if (!response.body) throw new Error('Missing Are.na response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new Error('Are.na response too large');
      chunks.push(value);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid Are.na response');
    return parsed as JsonObject;
  } finally { await reader.cancel().catch(() => {}); }
}

function channel(value: unknown): ArenaChannel | null {
  const item = object(value);
  if (typeof item.slug !== 'string' || !item.slug || typeof item.title !== 'string' ||
      !['public', 'closed'].includes(String(item.status)) || item.state === 'deleted') return null;
  const owner = person(item.group || item.user);
  const description = text(object(item.metadata).description);
  return {
    slug: item.slug.slice(0, 256), title: item.title.slice(0, 512), visibility: item.status as ArenaChannel['visibility'],
    ...(owner ? { owner } : {}), ...(description ? { description } : {}),
    ...(Number.isSafeInteger(item.length) && Number(item.length) >= 0 ? { blockCount: Number(item.length) } : {}),
  };
}

async function lookup(url: string, page: number, fetcher: Fetcher): Promise<ArenaLookupPage> {
  const signal = AbortSignal.timeout(12_000);
  // General v2 search remains public. Its results also include mentions, so only
  // a matching source URL is evidence that the page itself was saved.
  const params = new URLSearchParams({ q: url, per: String(PAGE_SIZE), page: String(page) });
  const result = await arenaJson(`search?${params}`, signal, fetcher);
  if (!Array.isArray(result.blocks)) throw new Error('Missing Are.na search results');
  const blocks: ArenaUrlBlock[] = [];
  const seen = new Set<number>();
  for (const value of result.blocks.slice(0, PAGE_SIZE)) {
    const block = object(value);
    if (!Number.isSafeInteger(block.id) || Number(block.id) <= 0 || seen.has(Number(block.id)) ||
        pageUrl(object(block.source).url) !== url) continue;
    seen.add(Number(block.id));
    const sourceTitle = text(object(block.source).title, 512);
    const previewUrl = preview(block.image);
    const creator = person(block.user);
    const createdAt = typeof block.created_at === 'string' && Number.isFinite(Date.parse(block.created_at))
      ? new Date(block.created_at).toISOString() : undefined;
    const excerpt = text(block.class === 'Text' ? block.content || block.description : block.description);
    blocks.push({
      id: Number(block.id), title: text(block.title, 512) || sourceTitle || 'Saved page',
      kind: ['Link', 'Text', 'Image', 'Media', 'Attachment'].includes(String(block.class)) ? block.class as ArenaUrlBlock['kind'] : 'Block',
      ...(sourceTitle ? { sourceTitle } : {}), ...(previewUrl ? { previewUrl } : {}),
      ...(creator ? { creator } : {}), ...(createdAt ? { createdAt } : {}),
      ...(excerpt && pageUrl(excerpt) !== url ? { excerpt } : {}),
      channels: { state: 'error' },
    });
  }
  let next = 0;
  // Bound the fan-out even when every result is a copy of the saved page.
  await Promise.all(Array.from({ length: Math.min(3, blocks.length) }, async () => {
    while (next < blocks.length) {
      const block = blocks[next++];
      try {
        const result = await arenaJson(`blocks/${block.id}/channels?per=${PAGE_SIZE}&page=1`, signal, fetcher);
        if (!Array.isArray(result.channels)) throw new Error('Missing Are.na channels');
        block.channels = {
          state: 'ready', items: result.channels.slice(0, PAGE_SIZE).map(channel).filter((item): item is ArenaChannel => !!item),
          hasMore: Number(result.total_pages) > 1,
        };
      } catch { /* Preserve the matching block when its channel lookup fails. */ }
    }
  }));
  return { blocks, nextPage: page < 1000 && Number(result.total_pages) > page ? page + 1 : null };
}

export function createArenaLookupRoute(fetcher: Fetcher = fetch) {
  const cache = new SnapshotCache<ArenaLookupPage>({
    maxEntries: 50, maxBytes: 2 * 1024 * 1024, ttlMs: 5 * 60 * 1000,
    concurrency: 2, maxPending: 4, size: value => Buffer.byteLength(JSON.stringify(value)),
    shouldCache: value => value.blocks.every(block => block.channels.state === 'ready'),
  });
  return async (request: Request): Promise<Response> => {
    const headers = { ...getCorsHeaders(request.headers.get('Origin') || ''), 'Cache-Control': 'no-store' };
    const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(body, { status, headers: { ...headers, ...extra } });
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    const params = new URL(request.url).searchParams;
    const input = params.get('url') || '';
    const url = pageUrl(input);
    const page = Number(params.get('page') ?? '1');
    if (!url || validateArchiveUrl(input) || !Number.isSafeInteger(page) || page < 1 || page > 1000) return json({ error: 'A public HTTP(S) URL and valid page are required' }, 400);
    if (request.signal.aborted) return json({ error: 'Request cancelled' }, 499);
    try {
      return json(await cache.getOrCreate(JSON.stringify([url, page]), () => lookup(url, page, fetcher)));
    } catch (error) {
      const limited = error instanceof UpstreamError && error.status === 429 || error instanceof ArchiveFetchError && error.status === 429;
      const retry = error instanceof UpstreamError ? Number(error.retryAfter) : NaN;
      return json({ error: 'Couldn’t load Are.na saves.' }, limited ? 429 : 502,
        limited ? { 'Retry-After': String(Number.isFinite(retry) && retry > 0 ? Math.min(Math.ceil(retry), 60) : 30) } : {});
    }
  };
}

export const arenaLookupRoute = createArenaLookupRoute();
