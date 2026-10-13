import { createArchive } from "@/api/archive/processor";
import { getCorsHeaders, optionsResponse } from "@/api/cors";
import { validateArchiveUrl } from "@/api/archive/url-validation";
import { RateLimiter } from "@/api/rate-limit";
import { ArchiveFetchError, fetchPublicResource, type PublicFetcher } from "@/api/archive/public-fetch";
import { MAX_ASSET_BYTES, validateAsset } from "@/api/archive/asset-validation";
import { SnapshotCache } from "@/api/archive/snapshot-cache";

const archiveReadLimiter = new RateLimiter(30, 5);
const archiveCaptureLimiter = new RateLimiter(3, 0.2);
const assetLimiter = new RateLimiter(30, 5);

export interface ArchiveResponse {
  resolvedUrl?: string;
  html: string;
  css?: string;
  textContent: string;
  title?: string;
  htmlAttrs?: Record<string, string>;
  bodyAttrs?: Record<string, string>;
}

// Only exact assets referenced by a successful archive are permitted. This is
// an abuse bound, not a replacement for destination validation on every fetch.
const permittedAssets = new Map<string, number>();
const ASSET_PERMISSION_TTL = 24 * 60 * 60 * 1000;
const MAX_PERMITTED_ASSETS = 5000;
function assetKey(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href;
}
export function registerArchiveAssets(archive: ArchiveResponse): void {
  const now = Date.now();
  for (const [url, expiry] of permittedAssets) if (expiry <= now) permittedAssets.delete(url);
  const sources = [archive.html, archive.css || "", archive.htmlAttrs?.style || "", archive.bodyAttrs?.style || ""];
  for (const source of sources) {
    for (const match of source.matchAll(/\/api\/asset-proxy\?url=([^\s"'<>()[\]]+)/g)) {
      try {
        const key = assetKey(decodeURIComponent(match[1].split("&")[0]));
        if (validateArchiveUrl(key)) continue;
        permittedAssets.delete(key);
        if (permittedAssets.size >= MAX_PERMITTED_ASSETS) {
          const oldest = permittedAssets.keys().next().value;
          if (oldest !== undefined) permittedAssets.delete(oldest);
        }
        permittedAssets.set(key, now + ASSET_PERMISSION_TTL);
      } catch { }
    }
  }
}

function errorResponse(error: unknown, cors: Record<string, string>, retryAfter = 2): Response {
  const known = error instanceof ArchiveFetchError;
  return Response.json({ error: known ? error.message : "Upstream fetch failed" }, {
    status: known ? error.status : 502,
    headers: { ...cors, "Cache-Control": "no-store", ...(known && error.status === 429 ? { "Retry-After": String(retryAfter) } : {}) },
  });
}
function clientIp(req: Request): string {
  // These headers must be supplied by the trusted reverse proxy.
  return req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || req.headers.get("CF-Connecting-IP") || "unknown";
}

export { optionsResponse as archiveOptionsRoute };

export function createArchiveHandler(service: typeof createArchive = createArchive) {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("Origin") || "";
    const cors = getCorsHeaders(origin);
    if (req.signal.aborted) return errorResponse(new ArchiveFetchError('Archive request cancelled', 499), cors);
    const ip = clientIp(req);
    if (!archiveReadLimiter.consume(ip)) return errorResponse(new ArchiveFetchError("Too many requests", 429), cors, 1);
    try {
      const requestUrl = new URL(req.url);
      const url = requestUrl.searchParams.get("url");
      if (!url) return errorResponse(new ArchiveFetchError("Missing url parameter", 400), cors);
      const error = validateArchiveUrl(url);
      if (error) return errorResponse(new ArchiveFetchError(error, 403), cors);
      const assetBase = requestUrl.hostname === "api.henry.ink" ? "https://api.henry.ink" : requestUrl.origin;
      const linkBase = origin === "https://henry.ink" ? "https://henry.ink" : undefined;
      const archive = await service(url, assetBase, linkBase, () => {
        if (!archiveCaptureLimiter.consume(ip)) throw new ArchiveFetchError('Too many captures', 429);
      });
      registerArchiveAssets(archive);
      return Response.json(archive, {
        headers: {
          ...cors,
          // Output varies by Origin; each response renews exact asset permissions.
          Vary: "Origin",
          "Cache-Control": "no-store",
          "Cloudflare-CDN-Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) { return errorResponse(error, cors, 5); }
  };
}

export const createArchiveRoute = createArchiveHandler();

const ASSET_CACHE_TTL = 15 * 60 * 1000;

function canCacheAsset(headers: Headers, now: number): boolean {
  const control = headers.get("cache-control") || "";
  if (headers.has("set-cookie") || /(?:^|,)\s*(?:private|no-store|no-cache)\b/i.test(control)
    || /no-cache/i.test(headers.get("pragma") || "") || headers.get("vary")?.split(",").some(value => value.trim() === "*")) return false;
  const age = headers.get("age");
  if (age !== null && !/^\d+$/.test(age)) return false;
  const date = headers.get("date");
  const dateMs = date === null ? now : Date.parse(date);
  if (!Number.isFinite(dateMs)) return false;
  const elapsed = Math.max(Number(age || 0) * 1000, now - dateMs, 0);
  const lifetimes: number[] = [];
  for (const directive of control.split(",")) {
    if (!/^\s*(?:s-maxage|max-age)\b/i.test(directive)) continue;
    const match = /^\s*(?:s-maxage|max-age)\s*=\s*(?:"(\d+)"|(\d+))\s*$/i.exec(directive);
    if (!match) return false;
    const lifetime = Number(match[1] || match[2]) * 1000;
    if (!Number.isFinite(lifetime)) return false;
    lifetimes.push(lifetime);
  }
  if (headers.has("expires")) {
    const expires = Date.parse(headers.get("expires")!);
    if (!Number.isFinite(expires)) return false;
    lifetimes.push(expires - dateMs);
  }
  // Use a bounded heuristic only when upstream specifies no freshness lifetime.
  // Skip explicit short freshness instead of adding revalidation or variable TTLs.
  return !lifetimes.length || Math.min(...lifetimes) - elapsed >= ASSET_CACHE_TTL;
}

interface DeliveredAsset {
  body: Buffer;
  contentType: string;
  expiresAt: number;
  cacheable: boolean;
}

export function createAssetProxyHandler(fetcher: PublicFetcher = fetchPublicResource, { now = Date.now }: { now?: () => number } = {}) {
  const cache = new SnapshotCache<DeliveredAsset>({
    maxEntries: 128, maxBytes: 32 * 1024 * 1024, ttlMs: ASSET_CACHE_TTL,
    concurrency: 8, maxPending: 16, now,
    size: value => value.body.length + Buffer.byteLength(value.contentType),
    shouldCache: value => value.cacheable,
  });
  const pending = new Map<string, { readers: number; promise: Promise<DeliveredAsset> }>();
  return async (req: Request): Promise<Response> => {
    const cors = getCorsHeaders(req.headers.get("Origin") || "");
    const cancelled = () => new ArchiveFetchError("Asset request cancelled", 499);
    if (req.signal.aborted) return errorResponse(cancelled(), cors);
    if (!assetLimiter.consume(clientIp(req))) return errorResponse(new ArchiveFetchError("Too many requests", 429), cors);
    try {
      const input = new URL(req.url).searchParams.get("url");
      if (!input) throw new ArchiveFetchError("Missing asset URL parameter", 400);
      const error = validateArchiveUrl(input);
      if (error) throw new ArchiveFetchError(error, 403);
      const key = assetKey(input);
      const checkPermission = () => {
        if ((permittedAssets.get(key) || 0) <= now()) throw new ArchiveFetchError("Asset is not referenced by a recent archive", 403);
      };
      checkPermission();
      let job = pending.get(key);
      if (!job) {
        const shared = { readers: 1 };
        const promise = cache.getOrCreate(key, async () => {
          // Orphaned queued work must not contact the origin. Active work remains
          // shared and bounded by the fetcher's deadline, even if one reader leaves.
          if (!shared.readers) throw cancelled();
          checkPermission();
          const resource = await fetcher(key, { allowHttp: true, maxBytes: MAX_ASSET_BYTES, timeoutMs: 5000, accept: "image/*,font/*,application/octet-stream;q=0.8" });
          if (resource.status !== 200) throw new ArchiveFetchError("Asset upstream returned an error", 502);
          const contentType = validateAsset(resource);
          const completedAt = now();
          return { body: resource.body, contentType, cacheable: canCacheAsset(resource.headers, completedAt), expiresAt: completedAt + ASSET_CACHE_TTL };
        });
        job = Object.assign(shared, { promise });
        pending.set(key, job);
        void job.promise.finally(() => { pending.delete(key); }).catch(() => {});
      } else job.readers++;
      let asset: DeliveredAsset;
      try {
        asset = await new Promise<DeliveredAsset>((resolve, reject) => {
          const abort = () => reject(cancelled());
          if (req.signal.aborted) return abort();
          req.signal.addEventListener("abort", abort, { once: true });
          job.promise.then(resolve, reject).finally(() => req.signal.removeEventListener("abort", abort));
        });
      } finally { job.readers--; }
      if (req.signal.aborted) throw cancelled();
      checkPermission();
      const maxAge = Math.max(0, Math.min(ASSET_CACHE_TTL / 1000, Math.floor((asset.expiresAt - now()) / 1000)));
      return new Response(Uint8Array.from(asset.body), {
        headers: {
          ...cors,
          Vary: "Origin",
          "Content-Type": asset.contentType,
          "Content-Length": String(asset.body.length),
          "Cache-Control": asset.cacheable ? `public, max-age=${maxAge}` : "no-store",
          "X-Content-Type-Options": "nosniff",
          // SVG remains useful in <img>, but cannot run scripts when navigated
          // to directly. These headers apply to every asset, including polyglots.
          "Content-Security-Policy": "sandbox; default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
          "Content-Disposition": "attachment",
        },
      });
    } catch (error) { return errorResponse(error, cors); }
  };
}

export const assetProxyRoute = createAssetProxyHandler();
