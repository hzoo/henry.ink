/**
 * URL validation for archive and asset proxy requests.
 * Blocks SSRF vectors: private IPs, loopback, link-local, cloud metadata.
 * Requires HTTPS and a proper domain name (no bare IPs).
 */

// IP address pattern (v4 and v6 variants)
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^\[?([0-9a-fA-F:]+)\]?$/;
// Hex/octal IP encodings (0x7f000001, 0177.0.0.1, etc.)
const HEX_IP_RE = /^0x[0-9a-fA-F]+$/i;
const OCTAL_IP_RE = /^0\d+/;

/**
 * Check if a hostname looks like an IP address (any encoding).
 * We block all IPs — archive targets must be domain names.
 */
function isIPAddress(hostname: string): boolean {
  // Strip brackets from IPv6
  const clean = hostname.replace(/^\[|\]$/g, '');

  if (IPV4_RE.test(clean)) return true;
  if (IPV6_RE.test(clean)) return true;

  // Check each octet for hex/octal encoding (e.g., 0x7f.0.0.1, 0177.0.0.1)
  const parts = clean.split('.');
  if (parts.length >= 2 && parts.every(p => /^\d+$/.test(p) || HEX_IP_RE.test(p) || OCTAL_IP_RE.test(p))) {
    return true;
  }

  // Single large integer (decimal IP like 2130706433 = 127.0.0.1)
  if (/^\d{4,}$/.test(clean)) return true;

  return false;
}

/**
 * Validate a URL is safe to fetch (no SSRF).
 * Returns null if valid, or an error message string if blocked.
 */
export function validateUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'Invalid URL';
  }

  // HTTPS only
  if (parsed.protocol !== 'https:') {
    return 'Only HTTPS URLs are allowed';
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block IP addresses entirely (prevents all encoding tricks)
  if (isIPAddress(hostname)) {
    return 'IP addresses are not allowed — use a domain name';
  }

  // Block localhost variants
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return 'localhost is not allowed';
  }

  return null; // URL is safe
}

/**
 * Validate archive URL — same as validateUrl but also allows HTTP
 * (some older sites are HTTP-only, and Playwright handles the fetch server-side).
 */
export function validateArchiveUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'Invalid URL';
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return 'Only HTTP and HTTPS URLs are allowed';
  }

  const hostname = parsed.hostname.toLowerCase();

  if (isIPAddress(hostname)) {
    return 'IP addresses are not allowed — use a domain name';
  }

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return 'localhost is not allowed';
  }

  return null;
}
