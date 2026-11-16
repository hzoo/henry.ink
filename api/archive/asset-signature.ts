import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, linkSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * A cleaned page names its images and fonts by address, and those addresses
 * must keep working after an API restart (the page may sit in the snapshot
 * cache, or in a reader's open tab). The proxy therefore serves exactly the
 * addresses this service signed while cleaning a page, instead of remembering
 * them. This is an abuse bound, not a replacement for destination validation
 * on every fetch.
 *
 * The key is nobody's to configure. The API makes one on first start and keeps
 * it beside the snapshot database, readable only by its own user. Deleting the
 * file rotates the key, which breaks images in already-cleaned pages until each is
 * next captured. If the file cannot be read or created the API does not start.
 */
export function loadSigningKey(directory: string): Buffer {
  const path = join(directory, "asset-signing.key");
  if (!existsSync(path)) {
    // Publish a complete file or none: link() fails if another process won.
    const draft = `${path}.${process.pid}.${randomBytes(4).toString("hex")}`;
    writeFileSync(draft, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
    try { linkSync(draft, path); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    finally { unlinkSync(draft); }
  }
  const key = Buffer.from(readFileSync(path, "utf8").trim(), "hex");
  if (key.length !== 32) throw new Error(`${path} is not a signing key; delete it to make a new one`);
  return key;
}

const key = loadSigningKey(dirname(process.env.ARCHIVE_CACHE_PATH || "archive-snapshots.db"));

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
