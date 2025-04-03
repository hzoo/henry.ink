import type { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";

const CACHE_PREFIX = "bsky-posts-";
const CACHE_VERSION = "v1";
const MAX_STORAGE_TARGET = 10 * 1024 * 1024; // Target max 10MB storage use

// In-memory cache for frequently accessed URLs
const memoryCache = new Map<string, CacheEntry>();
const MAX_MEMORY_ENTRIES = 50;

interface CacheEntry {
  posts: PostView[];
  lastAccessed: number;
  lastFetched: number; // When the data was last fetched from API
  version: string;
}

function getCacheKey(url: string): string {
  return `${CACHE_PREFIX}${CACHE_VERSION}-${url}`;
}

export function updatePostsCache(url: string, posts: PostView[]) {
  const entry: CacheEntry = {
    posts,
    lastAccessed: Date.now(),
    lastFetched: Date.now(),
    version: CACHE_VERSION
  };

  try {
    // Update localStorage
    localStorage.setItem(getCacheKey(url), JSON.stringify(entry));
    
    // Update memory cache
    memoryCache.set(url, entry);
    
    // Trim memory cache if needed
    if (memoryCache.size > MAX_MEMORY_ENTRIES) {
      const firstKey = memoryCache.keys().next().value;
      if (firstKey) {
        memoryCache.delete(firstKey);
      }
    }

    // Check storage size occasionally (1 in 20 chance)
    if (Math.random() < 0.05) {
      checkStorageSize();
    }
  } catch (e) {
    console.warn('Cache update failed:', e);
    // If storage is full, try to free up space
    checkStorageSize();
    try {
      localStorage.setItem(getCacheKey(url), JSON.stringify(entry));
    } catch (e) {
      console.error('Cache update failed after cleanup:', e);
    }
  }
}

export interface CacheInfo {
  posts: PostView[] | null;
  lastFetched: number | null;
}

export function getCachedPosts(url: string): CacheInfo {
  try {
    // Try memory cache first
    let entry = memoryCache.get(url);
    
    // If not in memory, try localStorage
    if (!entry) {
      const cached = localStorage.getItem(getCacheKey(url));
      if (cached) {
        entry = JSON.parse(cached) as CacheEntry;
        // Update memory cache
        memoryCache.set(url, entry);
      }
    }

    if (!entry || entry.version !== CACHE_VERSION) {
      return {
        posts: null,
        lastFetched: null,
      };
    }

    // Update last accessed time
    const now = Date.now();
    entry.lastAccessed = now;
    
    // Update storage with new access time
    try {
      localStorage.setItem(getCacheKey(url), JSON.stringify(entry));
    } catch (e) {
      // If update fails, it's not critical - we still have the data
      console.warn('Failed to update cache access time:', e);
    }

    return {
      posts: entry.posts,
      lastFetched: entry.lastFetched,
    };
  } catch (e) {
    console.warn('Cache read failed:', e);
    return {
      posts: null,
      lastFetched: null,
    };
  }
}

// Function to check and manage storage size
function checkStorageSize() {
  try {
    let totalSize = 0;
    const entries: Array<{ key: string; entry: CacheEntry; size: number }> = [];
    
    // Calculate sizes and collect entries
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(CACHE_PREFIX)) continue;
      
      try {
        const value = localStorage.getItem(key);
        if (!value) continue;
        
        const size = value.length * 2; // Approximate size in bytes
        totalSize += size;
        
        const entry = JSON.parse(value) as CacheEntry;
        entries.push({ key, entry, size });
      } catch (e) {
        // Remove corrupted entries
        localStorage.removeItem(key);
      }
    }
    
    // If we're over the target size, remove oldest accessed entries until under target
    if (totalSize > MAX_STORAGE_TARGET) {
      entries.sort((a, b) => a.entry.lastAccessed - b.entry.lastAccessed);
      
      while (totalSize > MAX_STORAGE_TARGET * 0.8 && entries.length > 0) {
        const oldest = entries.shift();
        if (oldest) {
          localStorage.removeItem(oldest.key);
          memoryCache.delete(oldest.key.replace(`${CACHE_PREFIX}${CACHE_VERSION}-`, ''));
          totalSize -= oldest.size;
        }
      }
    }
  } catch (e) {
    console.warn('Storage size check failed:', e);
  }
} 