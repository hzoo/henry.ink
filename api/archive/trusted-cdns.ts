// Shared configuration for trusted CDN domains
// These domains can be loaded directly without proxying for performance and security

export const TRUSTED_CDNS = [
  // Google services
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'ajax.googleapis.com',
  
  // Major CDNs
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'unpkg.com',
  
  // Font services
  'use.typekit.net',
  'fonts.bunny.net',
  
  // Cloud providers (generic patterns)
  'cloudfront.net',
  'github.githubassets.com',
  'assets.vercel.com',
] as const;

/**
 * Check if a URL/hostname is from a trusted CDN
 * Uses secure domain matching to prevent subdomain spoofing
 */
export function isTrustedCDN(urlOrHostname: string): boolean {
  try {
    const url = new URL(urlOrHostname);
    return isTrustedCDNDomain(url.hostname);
  } catch {
    // If not a valid URL, treat as hostname
    return isTrustedCDNDomain(urlOrHostname);
  }
}

/**
 * Check if a hostname is from a trusted CDN domain
 * Prevents spoofing like "evil-cdnjs.cloudflare.com" or "cloudflare.com.malicious.com"
 */
export function isTrustedCDNDomain(hostname: string): boolean {
  const normalizedHostname = hostname.replace(/^www\./, '').toLowerCase();
  
  return TRUSTED_CDNS.some(trustedDomain => {
    const normalizedTrusted = trustedDomain.toLowerCase();
    
    // Must be exact match OR a proper subdomain (preceded by a dot)
    return normalizedHostname === normalizedTrusted || 
           normalizedHostname.endsWith('.' + normalizedTrusted);
  });
}
