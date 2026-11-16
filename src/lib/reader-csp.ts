import { TRUSTED_CDNS } from '@/api/archive/trusted-cdns';

/**
 * The policy of the script-free article frame. The frame document carries it
 * as a meta element; every response that serves a stored page sends the same
 * policy as a header, so the copy is inert even if opened on its own.
 */
export function readerContentSecurityPolicy(assetOrigin: string): string {
  const assets = `${new URL(assetOrigin).origin}/api/asset-proxy`;
  const fonts = TRUSTED_CDNS.map(host => `https://${host} https://*.${host}`).join(' ');
  return `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src ${assets} data: ${fonts}; font-src ${assets} data: ${fonts}; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'none'; connect-src 'none'`;
}

/**
 * Sent with a stored page wherever it is served: inert, unindexed, and pointing
 * at its original. The caller adds the per-request CORS headers.
 */
export function storedPageHeaders(assetOrigin: string, sourceUrl: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Security-Policy': readerContentSecurityPolicy(assetOrigin),
    'X-Robots-Tag': 'noindex',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  };
  // URL.href is ASCII with <, > and whitespace percent-encoded, so it is header-safe.
  try { headers.Link = `<${new URL(sourceUrl).href}>; rel="canonical"`; } catch { /* No original to point at. */ }
  return headers;
}
