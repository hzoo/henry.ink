/**
 * Tangled repository data fetcher using AT Protocol
 * Fetches real repository data from sh.tangled.repo lexicon
 */

export interface TangledRepo {
  name: string;
  description?: string;
  owner: string;
  source?: string; // Present if it's a fork
  createdAt?: string;
  spindle?: string;
  knot?: string;
}

/**
 * Fetch Tangled repository data from AT Protocol
 */
export async function fetchTangledRepo(url: string, session?: any): Promise<TangledRepo | null> {
  try {
    // Parse the URL to get handle and rkey
    // Format: https://tangled.sh/@handle/repo-name
    const match = url.match(/tangled\.sh\/@([^\/]+)\/(.+)$/);
    if (!match) {
      console.warn('Invalid Tangled URL format:', url);
      return null;
    }
    
    const [_, handle, rkey] = match;
    
    // If we have a session, fetch the actual record data
    if (session) {
      try {
        const { ok, data } = await session.rpc.get('com.atproto.repo.getRecord', {
          params: { 
            repo: handle, 
            collection: 'sh.tangled.repo', 
            rkey 
          }
        });
        
        if (ok && data.value) {
          const record = data.value;
          return {
            name: record.name || rkey,
            description: record.description,
            owner: record.owner || handle,
            source: record.source, // Present for forks
            createdAt: record.createdAt,
            spindle: record.spindle,
            knot: record.knot,
          };
        }
      } catch (error) {
        console.warn('Failed to fetch Tangled repo data:', error);
      }
    }
    
    // Fallback: parse from URL when no session or fetch fails
    return { 
      name: rkey, 
      owner: handle 
    };
    
  } catch (error) {
    console.error('Error parsing Tangled URL:', error);
    return null;
  }
}

/**
 * Check if a URL is a Tangled repository URL
 */
export function isTangledRepoUrl(url: string): boolean {
  return /^https:\/\/tangled\.sh\/@[^\/]+\/.+$/.test(url);
}