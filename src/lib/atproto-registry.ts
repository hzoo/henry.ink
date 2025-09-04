/**
 * Registry of AT Protocol sites and their URL patterns
 * Easy to extend with PRs - just add new patterns!
 */

interface AtProtoPattern {
  collection: string;
  handle: string;
  rkey: string;
}

// Simple registry - easy to extend with PRs
const ATPROTO_SITES = {
  'bsky.app': {
    '/profile/:handle/post/:rkey': 'app.bsky.feed.post',
    // Easy to add more:
    // '/profile/:handle/lists/:rkey': 'app.bsky.graph.list',
    // '/profile/:handle/feed/:rkey': 'app.bsky.feed.generator',
  },
  // Future sites can be added here:
  // 'whtwnd.com': {
  //   '/:handle/entries/:rkey': 'com.whtwnd.blog.entry',
  // },
  // 'smokesignal.events': {
  //   '/:handle/events/:rkey': 'fyi.unravel.smokesignal.event',
  // },
} as const;

/**
 * Detect if a URL points to an AT Protocol record
 * Returns collection type and extracted parameters, or null if not recognized
 */
export function detectAtProtoRecord(url: string): AtProtoPattern | null {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const pathname = urlObj.pathname;
    
    // Check if domain is in our registry
    if (!(domain in ATPROTO_SITES)) {
      return null;
    }
    
    const patterns = ATPROTO_SITES[domain as keyof typeof ATPROTO_SITES];
    
    // Try to match against each pattern for this domain
    for (const [pattern, collection] of Object.entries(patterns)) {
      const match = matchPattern(pattern, pathname);
      if (match) {
        return {
          collection,
          handle: match.handle,
          rkey: match.rkey,
        };
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Simple pattern matcher for URL paths
 * Supports :param syntax like "/profile/:handle/post/:rkey"
 */
function matchPattern(pattern: string, pathname: string): { handle: string; rkey: string } | null {
  // Convert pattern to regex
  // "/profile/:handle/post/:rkey" -> "^/profile/([^/]+)/post/([^/]+)$"
  const regexPattern = pattern
    .replace(/:[^/]+/g, '([^/]+)')
    .replace(/\//g, '\\/');
    
  const regex = new RegExp(`^${regexPattern}$`);
  const match = pathname.match(regex);
  
  if (!match) {
    return null;
  }
  
  // Extract parameter names from pattern
  const paramNames: string[] = [];
  let paramMatch;
  const paramRegex = /:([^/]+)/g;
  while ((paramMatch = paramRegex.exec(pattern)) !== null) {
    paramNames.push(paramMatch[1]);
  }
  const params: Record<string, string> = {};
  
  paramNames.forEach((name, index) => {
    params[name] = match[index + 1];
  });
  
  // For now, assume we always have handle and rkey
  // Could be made more generic later
  if (!params.handle || !params.rkey) {
    return null;
  }
  
  return {
    handle: params.handle,
    rkey: params.rkey,
  };
}

/**
 * Check if a URL is from a known AT Protocol site
 */
export function isAtProtoSite(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname in ATPROTO_SITES;
  } catch {
    return false;
  }
}

/**
 * Get all supported domains (useful for documentation/debugging)
 */
export function getSupportedDomains(): string[] {
  return Object.keys(ATPROTO_SITES);
}