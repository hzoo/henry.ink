import { currentPosts, loading, error, cacheTimeAgo } from "@/lib/signals";
import { getCachedPosts, updatePostsCache } from "@/lib/postCache";
import { searchBskyPosts } from "@/lib/bsky";

interface FetchOptions {
  showLoading?: boolean;
  signal?: AbortSignal;
}

interface FetchError extends Error {
  name: string;
  message: string;
}

export async function fetchPosts(url: string, options: FetchOptions = {}) {
  const { showLoading = true, signal } = options;

  if (showLoading) {
    loading.value = true;
  }
  error.value = "";

  try {
    const fetchedPosts = await searchBskyPosts(url, {signal});
    if (fetchedPosts) {
      updatePostsCache(url, fetchedPosts);
      currentPosts.value = fetchedPosts;
      cacheTimeAgo.value = Date.now();
    }
    loading.value = false;
  } catch (err) {
    // Don't show error if it was just aborted
    const fetchError = err as FetchError;
    if (fetchError.cause !== 'URL changed') {
      const authErrorMessage = 'Bluesky search sometimes requires login due to high load. See:';
      const authErrorLink = 'https://github.com/hzoo/extension-annotation-sidebar/issues/8';
      
      // Check for the specific authentication error message pattern
      if (fetchError.message.startsWith(authErrorMessage)) { 
        // Set the error as an object with message and link
        error.value = { message: authErrorMessage, link: authErrorLink };
      } else {
        // Otherwise, set the error as just the string message
        error.value = fetchError.message || "Failed to fetch Bluesky posts";
      }
    }
    loading.value = false;
  }
}

export async function loadFromCacheAndUpdate(url: string, signal?: AbortSignal) {
  // Try to load from cache first
  const { posts, lastFetched } = getCachedPosts(url);
  
  if (posts) {
    currentPosts.value = posts;
    cacheTimeAgo.value = lastFetched;
    loading.value = false;

    // Only fetch fresh data if cache is older than 1 day
    const shouldRefresh = !lastFetched || Date.now() - lastFetched > 24 * 60 * 60 * 1000;
    if (shouldRefresh) {
      // Fetch fresh data in the background
      try {
        const fetchedPosts = await searchBskyPosts(url, {signal});
        const now = Date.now();
        
        if (fetchedPosts && fetchedPosts.length > (posts?.length || 0)) {
          // Update cache with new posts if we found more
          updatePostsCache(url, fetchedPosts);
          currentPosts.value = fetchedPosts;
        } else {
          // Just update the lastFetched time to prevent unnecessary refreshes
          updatePostsCache(url, posts);
        }
        cacheTimeAgo.value = now;
      } catch (err) {
        const fetchError = err as FetchError;
        // Also handle potential auth error during background refresh
        const authErrorMessage = 'Bluesky search sometimes requires login due to high load. See:';
        if (fetchError.message.startsWith(authErrorMessage)) {
            // Don't show error in UI for background refresh, but log it
            console.warn('Background refresh failed due to auth:', fetchError.message);
        } else {
            console.warn('Background refresh failed:', err);
        }
      }
    }
    return true;
  }
  return false;
} 