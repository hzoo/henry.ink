import { searchBskyPosts } from "@/lib/bsky";
import { currentPosts, loading, error, contentSourceUrl } from "@/lib/signals";
import { useRef, useEffect } from "react";

export function ManualFetchButton() {
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup: abort any pending request when component unmounts
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  const handleFetch = async () => {
    // Abort previous request if it exists
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    
    loading.value = true;
    error.value = '';
    
    controllerRef.current = new AbortController();
    
    try {
      currentPosts.value = await searchBskyPosts(contentSourceUrl.value, controllerRef.current.signal) || [];
      loading.value = false;
    } catch (err: unknown) {
      // Don't set error if it was just aborted
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Error fetching posts:', err);
        error.value = err.message || 'Failed to fetch Bluesky posts';
      }
      loading.value = false;
    }
  };

  return (
    <button
      className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-800/40 text-green-700 dark:text-green-300 rounded-md text-sm font-medium transition-colors"
      onClick={handleFetch}
      aria-label="Search for Bluesky posts"
    >
      <Icon name="magnifying" className="h-4 w-4" />
      Search Posts
    </button>
  );
} 