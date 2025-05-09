import type { AppBskyFeedDefs } from "@atcute/client/lexicons";
import type { ThreadReply } from "@/lib/types";

// --- Unified Cache Configuration ---
const CACHE_INDEX_KEY = "bsky-cache-index-v1";
const CACHE_VERSION = "v1"; // Keep versioning for potential future format changes
const MAX_CACHE_ITEMS = 100; // Max number of items (posts or threads) in the cache
const MAX_MEMORY_ENTRIES = 50; // Max number of items in the memory cache (subset of total)

// --- Types ---

// Structure for data stored in localStorage (includes lastFetched time)
interface StoredCacheItem<T> {
  data: T;
  lastFetched: number;
  version: string;
}

// Structure for entries in the index
interface IndexEntry {
  // storageKey: string; // The actual localStorage key - REMOVED
  lastAccessed: number;
}

// Structure for the index stored in localStorage
type CacheIndex = {
  // Key is the unified key (e.g., "post-url" or "thread-uri")
  [unifiedKey: UnifiedKey]: IndexEntry;
}

type KeyType = 'post' | 'thread';
type UnifiedKey = `${KeyType}-${string}`;

const memoryCache = new Map<string, { data: AppBskyFeedDefs.PostView[] | ThreadReply[], lastFetched: number }>();

function getUnifiedKey(type: KeyType, id: string): UnifiedKey {
  return `${type}-${id}`;
}

function getStorageKey(unifiedKey: UnifiedKey): string {
  const separatorIndex = unifiedKey.indexOf('-');
  const type = unifiedKey.substring(0, separatorIndex) as KeyType;
  const id = unifiedKey.substring(separatorIndex + 1);
  const prefix = type === 'post' ? 'bsky-posts-' : 'bsky-thread-';

  return `${prefix}${CACHE_VERSION}-${id}`;
}

function readCacheIndex(): CacheIndex {
  try {
    const indexStr = localStorage.getItem(CACHE_INDEX_KEY);
    if (indexStr) {
      const index = JSON.parse(indexStr);
      if (typeof index === 'object' && index !== null) {
        return index;
      }
    }
  } catch (e) {
    console.warn('Failed to read or parse cache index:', e);
    localStorage.removeItem(CACHE_INDEX_KEY);
  }
  return {};
}

function writeCacheIndex(index: CacheIndex) {
  try {
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.error('Failed to write cache index:', e);
    // If writing fails, trigger cleanup immediately, likely due to quota
    checkCacheLimits(true);
  }
}

function trimMemoryCache() {
  while (memoryCache.size > MAX_MEMORY_ENTRIES) {
    // Simple FIFO for memory cache eviction - could also use LRU based on memory access
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) {
      memoryCache.delete(firstKey);
    } else {
      break; // Should not happen if size > 0
    }
  }
}

// Core function to update a cache item (memory, storage, index)
function _updateCacheItem(unifiedKey: UnifiedKey, data: AppBskyFeedDefs.PostView[] | ThreadReply[]) {
  const now = Date.now();
  const storageKey = getStorageKey(unifiedKey);
  const itemToStore: StoredCacheItem<typeof data> = {
    data,
    lastFetched: now,
    version: CACHE_VERSION,
  };

  try {
    const itemStr = JSON.stringify(itemToStore);
    localStorage.setItem(storageKey, itemStr);

    // Update memory cache
    memoryCache.set(unifiedKey, { data, lastFetched: now });
    trimMemoryCache();

    // Update index
    const index = readCacheIndex();
    index[unifiedKey] = {
      // storageKey, // REMOVED
      lastAccessed: now,
    };
    writeCacheIndex(index);

  } catch (e) {
    console.warn(`Failed to cache item ${unifiedKey}:`, e);
    // If initial write fails, trigger cleanup and try again
    checkCacheLimits(true); // Force check
    try {
      // Try storing again after cleanup
      localStorage.setItem(storageKey, JSON.stringify(itemToStore));
      // Update index if second attempt succeeds
      const index = readCacheIndex();
      index[unifiedKey] = {
        // storageKey, // REMOVED
        lastAccessed: now,
      };
      writeCacheIndex(index);
      // Also update memory cache on successful second attempt
      memoryCache.set(unifiedKey, { data, lastFetched: now });
      trimMemoryCache();
    } catch (e2) {
      console.error(`Failed to cache item ${unifiedKey} even after cleanup:`, e2);
      // Cleanup might have failed, or we are completely out of space
      // Remove item from memory if it got added
      memoryCache.delete(unifiedKey);
    }
  }
}

// Core function to retrieve a cache item
function _getCachedItem(unifiedKey: UnifiedKey): { data: AppBskyFeedDefs.PostView[] | ThreadReply[], lastFetched: number } | null {
  try {
    // 1. Try memory cache first
    const memEntry = memoryCache.get(unifiedKey);
    if (memEntry) {
      // Update access time in index even for memory hit
      const index = readCacheIndex();
      if (index[unifiedKey]) {
        index[unifiedKey].lastAccessed = Date.now();
        writeCacheIndex(index);
      }
      return memEntry;
    }

    // 2. Try localStorage
    const index = readCacheIndex();
    const indexEntry = index[unifiedKey];
    if (!indexEntry || typeof indexEntry.lastAccessed !== 'number') { // Added validation
      // If entry exists but is invalid, clean it up
      if (index[unifiedKey]) {
          delete index[unifiedKey];
          writeCacheIndex(index);
          // Also try removing potential storage item if key exists
          localStorage.removeItem(getStorageKey(unifiedKey)); 
      }
      return null; // Not in index, assume not cached
    }

    const storageKey = getStorageKey(unifiedKey); // Reconstruct storage key
    const storedStr = localStorage.getItem(storageKey);
    if (!storedStr) {
      // Item in index but not in storage? Clean up index.
      console.warn(`Index entry found for ${unifiedKey} but item missing from storage. Cleaning index.`);
      delete index[unifiedKey];
      writeCacheIndex(index);
      return null;
    }

    const storedItem = JSON.parse(storedStr) as StoredCacheItem<AppBskyFeedDefs.PostView[] | ThreadReply[]>;

    // Validate version
    if (!storedItem || typeof storedItem !== 'object' || storedItem.version !== CACHE_VERSION) {
      console.warn(`Invalidating stale cache entry for ${unifiedKey}`);
      localStorage.removeItem(storageKey); // Use reconstructed key
      delete index[unifiedKey];
      writeCacheIndex(index);
      return null;
    }

    // Valid item found in storage: update memory, update index access time
    const now = Date.now();
    memoryCache.set(unifiedKey, { data: storedItem.data, lastFetched: storedItem.lastFetched });
    trimMemoryCache();

    indexEntry.lastAccessed = now;
    writeCacheIndex(index);

    return { data: storedItem.data, lastFetched: storedItem.lastFetched };

  } catch (e) {
    console.warn(`Failed to retrieve cached item ${unifiedKey}:`, e);
    // Attempt to clean up potentially corrupted index entry if key exists
    try {
        const index = readCacheIndex();
        if (index[unifiedKey]) {
            const keyToRemove = getStorageKey(unifiedKey); // Reconstruct key
            delete index[unifiedKey];
            writeCacheIndex(index);
            localStorage.removeItem(keyToRemove); // Also remove storage item
        }
    } catch (cleanupError) {
        console.error("Error during cache cleanup:", cleanupError);
    }
    return null;
  }
}

// --- Cache Eviction --- Function based on item count LRU
function checkCacheLimits(forceCheck = false) {
  // Avoid running frequently unless forced (e.g., on write error)
  if (!forceCheck) { 
    // No random check anymore, rely on forced checks during write errors
    return;
  }

  try {
    const index = readCacheIndex();
    const indexEntries = Object.entries(index) as [UnifiedKey, IndexEntry][];
    let currentItemCount = indexEntries.length;

    if (currentItemCount <= MAX_CACHE_ITEMS) return; // Below limit

    console.log(`Cache item count (${currentItemCount}) exceeds limit (${MAX_CACHE_ITEMS}). Evicting LRU items...`);

    // Prepare for sorting - ensure valid entries and reconstruct storageKey
    const entriesForSorting: Array<{ unifiedKey: UnifiedKey; lastAccessed: number; storageKey: string }> = [];
    for (const [unifiedKey, entryData] of indexEntries) {
      // Validate entry and reconstruct storageKey
      if (entryData && typeof entryData === 'object' && typeof entryData.lastAccessed === 'number') {
        const storageKey = getStorageKey(unifiedKey);
        entriesForSorting.push({ unifiedKey, lastAccessed: entryData.lastAccessed, storageKey });
      } else {
        console.warn(`Removing invalid entry from cache index during eviction check: ${unifiedKey}`);
        delete index[unifiedKey];
        currentItemCount--;
      }
    }

    // Sort by oldest accessed first
    entriesForSorting.sort((a, b) => a.lastAccessed - b.lastAccessed);

    const targetItemCount = Math.floor(MAX_CACHE_ITEMS * 0.8); // Target 80%
    let itemsRemoved = 0;
    const itemsToEvict = currentItemCount - targetItemCount;

    for (let i = 0; i < itemsToEvict && i < entriesForSorting.length; i++) {
      const oldest = entriesForSorting[i];
      try {
        localStorage.removeItem(oldest.storageKey);
        delete index[oldest.unifiedKey];
        memoryCache.delete(oldest.unifiedKey);
        itemsRemoved++;
      } catch (e) {
        console.warn(`Failed to remove cache item ${oldest.storageKey} during eviction:`, e);
        // Still remove from index to prevent trying again immediately
        if (index[oldest.unifiedKey]) {
          delete index[oldest.unifiedKey];
        }
      }
    }

    if (itemsRemoved > 0) {
      writeCacheIndex(index); // Write the cleaned index back
      console.log(`Eviction finished. Removed ${itemsRemoved} items.`);
    }

  } catch (e) {
    console.error('Cache limit check/eviction failed:', e);
  }
}

export interface ThreadCacheInfo {
  replies: ThreadReply[] | null;
  lastFetched: number | null;
}

export function updateThreadCache(uri: string, replies: ThreadReply[]) {
  const unifiedKey = getUnifiedKey('thread', uri);
  _updateCacheItem(unifiedKey, replies);
}

export function getCachedThread(uri: string): ThreadCacheInfo {
  const unifiedKey = getUnifiedKey('thread', uri);
  const result = _getCachedItem(unifiedKey);
  return {
    replies: result?.data as ThreadReply[] ?? null,
    lastFetched: result?.lastFetched ?? null,
  };
}