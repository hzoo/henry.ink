import { resolveFromIdentity } from '@atcute/oauth-browser-client';

// Cache for the entire session - cleared on page refresh
const didCache = new Map<string, string>();

// Try direct resolution for custom domains (not Bluesky)
const tryDirectResolution = async (handle: string): Promise<string | null> => {
  // Skip Bluesky domains
  if (handle.endsWith('.bsky.social') || handle.endsWith('.bsky.team')) return null;
  
  // Check cache first
  const cached = didCache.get(handle);
  if (cached) {
    console.log(`Using cached DID for ${handle}`);
    return cached;
  }
  
  try {
    const response = await fetch(
      `https://${handle}/.well-known/atproto-did`,
      { signal: AbortSignal.timeout(1000) } // 1 second timeout
    );
    if (response.ok) {
      const did = (await response.text()).trim();
      if (did.startsWith('did:')) {
        // Cache forever (this session)
        didCache.set(handle, did);
        console.log(`Resolved ${handle} via direct HTTP (cached)`);
        return did;
      }
    }
  } catch {
    // Silently fail - CORS issues or network errors are expected
  }
  return null;
};

// Enhanced resolver with direct resolution attempt
export const resolveFromIdentityEnhanced = async (handleOrDid: string) => {
  // Skip for DIDs
  if (handleOrDid.startsWith('did:')) {
    return resolveFromIdentity(handleOrDid);
  }
  
  // Try direct resolution first for custom domains
  const directDid = await tryDirectResolution(handleOrDid);
  if (directDid) {
    // Got DID directly, now resolve metadata from it
    return resolveFromIdentity(directDid);
  }
  
  // Fallback to default resolver
  return resolveFromIdentity(handleOrDid);
};