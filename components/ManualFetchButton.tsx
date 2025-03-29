import { searchBskyPosts } from "@/lib/bsky";
import { currentPosts, loading, error, contentSourceUrl } from "@/lib/signals";

const handleFetch = async () => {
  loading.value = true;
  error.value = '';

  try {
    currentPosts.value = await searchBskyPosts(contentSourceUrl.value) || [];
    loading.value = false;
  } catch (err) {
    console.error('Error fetching posts:', err);
    error.value = 'Failed to fetch Bluesky posts';
    loading.value = false;
  }
};

export function ManualFetchButton() {
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