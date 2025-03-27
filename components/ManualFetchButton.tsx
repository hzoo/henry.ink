import { searchBskyPosts } from "@/lib/bsky";
import { contentItems, loading, error, contentSourceUrl } from "@/lib/signals";

const handleFetch = async () => {
  loading.value = true;
  error.value = '';

  try {
    const posts = await searchBskyPosts(contentSourceUrl.value);
    contentItems.value = posts;
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
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      Search Posts
    </button>
  );
} 