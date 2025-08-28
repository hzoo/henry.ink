/**
 * Helpers for AT Protocol URL/URI conversion and record fetching
 */

/**
 * Convert a Bluesky URL to an AT-URI
 * Example: https://bsky.app/profile/henryzoo.com/post/3lx27hzibas2c
 * → at://did:plc:xxx/app.bsky.feed.post/3lx27hzibas2c
 */
export function bskyUrlToAtUri(url: string, did?: string): string | null {
  try {
    const urlObj = new URL(url);
    
    // Only handle bsky.app URLs
    if (urlObj.hostname !== 'bsky.app') {
      return null;
    }
    
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    // Expected format: /profile/{handle}/post/{rkey}
    if (pathParts.length === 4 && pathParts[0] === 'profile' && pathParts[2] === 'post') {
      const handle = pathParts[1];
      const rkey = pathParts[3];
      
      // If DID is provided, use it; otherwise use handle directly
      const repo = did || handle;
      
      return `at://${repo}/app.bsky.feed.post/${rkey}`;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a string is already an AT-URI
 */
export function isAtUri(str: string): boolean {
  return str.startsWith('at://');
}

/**
 * Extract handle from AT-URI or Bluesky URL
 */
export function extractHandle(input: string): string | null {
  if (isAtUri(input)) {
    // Extract from AT-URI: at://did:plc:xxx/... or at://handle.com/...
    const match = input.match(/^at:\/\/([^\/]+)/);
    if (match) {
      const repo = match[1];
      // If it's a DID, we can't extract handle
      if (repo.startsWith('did:')) {
        return null;
      }
      return repo; // It's a handle
    }
  } else {
    // Extract from Bluesky URL
    const atUri = bskyUrlToAtUri(input);
    if (atUri) {
      return extractHandle(atUri);
    }
  }
  
  return null;
}

/**
 * Resolve handle to DID using AT Protocol
 */
export async function resolveHandle(handle: string, rpc: any): Promise<string | null> {
  try {
    const { ok, data } = await rpc.get('com.atproto.identity.resolveHandle', {
      params: { handle }
    });
    
    if (ok && data.did) {
      return data.did;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to resolve handle:', handle, error);
    return null;
  }
}

/**
 * Get record CID from AT-URI
 */
export async function getRecordCid(atUri: string, rpc: any): Promise<string | null> {
  try {
    // Parse AT-URI: at://did:plc:xxx/collection/rkey
    const match = atUri.match(/^at:\/\/([^\/]+)\/([^\/]+)\/(.+)$/);
    if (!match) {
      return null;
    }
    
    const [, repo, collection, rkey] = match;
    
    const { ok, data } = await rpc.get('com.atproto.repo.getRecord', {
      params: {
        repo,
        collection,
        rkey
      }
    });
    
    if (ok && data.cid) {
      return data.cid;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to get record CID:', atUri, error);
    return null;
  }
}

/**
 * Convert any input (Bluesky URL or AT-URI) to a resolved AT-URI with DID
 */
export async function normalizeToAtUri(input: string, rpc: any): Promise<{ atUri: string; cid: string } | null> {
  try {
    let atUri: string;
    
    if (isAtUri(input)) {
      atUri = input;
    } else {
      // Try to convert Bluesky URL
      const converted = bskyUrlToAtUri(input);
      if (!converted) {
        return null;
      }
      atUri = converted;
    }
    
    // If AT-URI contains a handle instead of DID, resolve it
    const match = atUri.match(/^at:\/\/([^\/]+)\/(.+)$/);
    if (!match) {
      return null;
    }
    
    const [, repo, rest] = match;
    let resolvedRepo = repo;
    
    // If repo is not a DID (doesn't start with 'did:'), resolve the handle
    if (!repo.startsWith('did:')) {
      const resolvedDid = await resolveHandle(repo, rpc);
      if (!resolvedDid) {
        return null;
      }
      resolvedRepo = resolvedDid;
      atUri = `at://${resolvedDid}/${rest}`;
    }
    
    // Get the CID
    const cid = await getRecordCid(atUri, rpc);
    if (!cid) {
      return null;
    }
    
    return { atUri, cid };
  } catch (error) {
    console.warn('Failed to normalize AT-URI:', input, error);
    return null;
  }
}