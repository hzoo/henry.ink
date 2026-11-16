import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stored pages name their images and fonts by address, and those addresses must
 * keep working after an API restart. The proxy therefore serves exactly the
 * addresses this service signed while cleaning a page, instead of remembering
 * them. This is an abuse bound, not a replacement for destination validation
 * on every fetch.
 *
 * ASSET_SIGNING_KEY is required in production. Without it, development and
 * tests use the public default below, which protects nothing. Changing the key
 * breaks images in stored pages until each page is next refreshed.
 */
export const DEV_ASSET_SIGNING_KEY = "henry-ink-dev-asset-key";

export function resolveSigningKey(value: string | undefined, production: boolean): string {
  if (value && value.length >= 32) return value;
  if (value) throw new Error("ASSET_SIGNING_KEY must be at least 32 characters");
  if (production) throw new Error("ASSET_SIGNING_KEY is required in production");
  return DEV_ASSET_SIGNING_KEY;
}

const key = resolveSigningKey(process.env.ASSET_SIGNING_KEY, process.env.NODE_ENV === "production");

/** Fragments never reach the asset's server, so they are not part of its identity. */
export function assetKey(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href;
}

function sign(url: string): Buffer {
  // 128 bits is ample for a tag that only gates a rate-limited public proxy.
  return createHmac("sha256", key).update(assetKey(url)).digest().subarray(0, 16);
}

export function assetProxyUrl(apiOrigin: string, url: string): string {
  return `${apiOrigin}/api/asset-proxy?url=${encodeURIComponent(url)}&sig=${sign(url).toString("base64url")}`;
}

export function isSignedAsset(url: string, signature: string | null): boolean {
  if (!signature) return false;
  try {
    const given = Buffer.from(signature, "base64url");
    const expected = sign(url);
    return given.length === expected.length && timingSafeEqual(given, expected);
  } catch { return false; }
}
