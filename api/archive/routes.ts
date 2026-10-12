import { createArchive } from "@/api/archive/processor";
import { getCorsHeaders, optionsResponse } from "@/api/cors";
import { validateArchiveUrl } from "@/api/archive/url-validation";
import { RateLimiter } from "@/api/rate-limit";
import { ArchiveFetchError, fetchPublicResource, type PublicFetcher, type PublicResource } from "@/api/archive/public-fetch";
import { MAX_ASSET_BYTES, validateAsset } from "@/api/archive/asset-validation";

const archiveLimiter = new RateLimiter(3, 0.2);
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

export async function createArchiveRoute(req: Request): Promise<Response> {
  const origin = req.headers.get("Origin") || "";
  const cors = getCorsHeaders(origin);
  if (!archiveLimiter.consume(clientIp(req))) return errorResponse(new ArchiveFetchError("Too many requests", 429), cors, 5);
  try {
    const requestUrl = new URL(req.url);
    const url = requestUrl.searchParams.get("url");
    if (!url) return errorResponse(new ArchiveFetchError("Missing url parameter", 400), cors);
    const error = validateArchiveUrl(url);
    if (error) return errorResponse(new ArchiveFetchError(error, 403), cors);
    const assetBase = requestUrl.hostname === "api.henry.ink" ? "https://api.henry.ink" : requestUrl.origin;
    const linkBase = origin === "https://henry.ink" ? "https://henry.ink" : undefined;
    const archive = await createArchive(url, assetBase, linkBase);
    registerArchiveAssets(archive);
    return Response.json(archive, {
      headers: {
        ...cors,
        // Output varies by Origin, and proxy permissions are process-local.
        Vary: "Origin",
        "Cache-Control": "no-store",
        "Cloudflare-CDN-Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) { return errorResponse(error, cors); }
}

export function createAssetProxyHandler(fetcher: PublicFetcher = fetchPublicResource) {
  const pending = new Map<string, Promise<{ resource: PublicResource; contentType: string }>>();
  return async (req: Request): Promise<Response> => {
    const cors = getCorsHeaders(req.headers.get("Origin") || "");
    if (!assetLimiter.consume(clientIp(req))) return errorResponse(new ArchiveFetchError("Too many requests", 429), cors);
    try {
      const input = new URL(req.url).searchParams.get("url");
      if (!input) throw new ArchiveFetchError("Missing asset URL parameter", 400);
      const error = validateArchiveUrl(input);
      if (error) throw new ArchiveFetchError(error, 403);
      const key = assetKey(input);
      if ((permittedAssets.get(key) || 0) <= Date.now()) throw new ArchiveFetchError("Asset is not referenced by a recent archive", 403);
      let job = pending.get(key);
      if (!job) {
        if (pending.size >= 8) throw new ArchiveFetchError("Too many asset downloads", 429);
        job = fetcher(key, { allowHttp: true, maxBytes: MAX_ASSET_BYTES, timeoutMs: 5000, accept: "image/*,font/*,application/octet-stream;q=0.8" }).then(resource => {
          if (resource.status < 200 || resource.status >= 300) throw new ArchiveFetchError("Asset upstream returned an error", 502);
          return { resource, contentType: validateAsset(resource) };
        });
        pending.set(key, job);
        void job.finally(() => { pending.delete(key); }).catch(() => {});
      }
      const { resource, contentType } = await job;
      return new Response(Uint8Array.from(resource.body), {
        headers: {
          ...cors,
          Vary: "Origin",
          "Content-Type": contentType,
          "Content-Length": String(resource.body.length),
          "Cache-Control": "public, max-age=900",
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
