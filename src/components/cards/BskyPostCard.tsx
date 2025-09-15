/**
 * Bluesky post card component
 * Handles strongRef marks that point to Bluesky posts
 */
import { useQuery } from "@tanstack/react-query";
import type { StoredMark } from "@/api/trails/trail-storage";
import { fetchPostFromAtUri } from "@/src/lib/atproto-post-fetcher";
import { ProfilePost } from "@/henry-ink/components/ProfilePost";
import { atCuteState } from "@/demo/lib/oauth";

interface BskyPostCardProps {
  url: string;
  mark: StoredMark;
  onClick?: (mark: StoredMark) => void;
  className?: string;
  handle: string;
  rkey: string;
}

export function BskyPostCard({ url, mark, onClick, className, handle, rkey }: BskyPostCardProps) {
  const session = atCuteState.value;
  
  const handleClick = () => {
    if (onClick) {
      onClick(mark);
    }
    // Note: Don't open URL directly here, let onClick handler decide
  };

  // Fetch post data for strongRef marks
  const { data: postData, isLoading: isLoadingPost } = useQuery({
    queryKey: ['post-data', mark.subject_uri],
    queryFn: async () => {
      if (!mark.subject_uri || !session) {
        return null;
      }
      return await fetchPostFromAtUri(mark.subject_uri, session);
    },
    enabled: !!mark.subject_uri && !!session,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Loading state
  if (isLoadingPost) {
    return (
      <div className={`col-span-2 sm:col-span-2 lg:col-span-2 xl:col-span-2 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 h-32 flex items-center justify-center ${className || ''}`}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Loading post...</span>
        </div>
      </div>
    );
  }

  // Failed to load post data
  if (!postData) {
    return (
      <div className={`col-span-1 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 text-center ${className || ''}`}>
        <div className="text-gray-500 dark:text-gray-400">
          <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="text-sm">Unable to load post</div>
        </div>
      </div>
    );
  }

  // Success: render post with note
  return (
    <div 
      className={`col-span-2 sm:col-span-2 lg:col-span-2 xl:col-span-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer group h-fit ${className || ''}`}
      onClick={handleClick}
    >
      {/* Note at top with purple styling */}
      {mark.note && (
        <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/10 border-b border-purple-100 dark:border-purple-800/30">
          <div className="text-sm text-purple-700 dark:text-purple-300 line-clamp-2">
            › {mark.note}
          </div>
        </div>
      )}
      <div className="p-0">
        <ProfilePost post={postData} displayItems={["avatar", "displayName", "handle"]} />
      </div>
    </div>
  );
}

/**
 * Modal version of BskyPostCard for detailed view
 */
export function BskyPostCardModal({ url, mark, handle, rkey }: Omit<BskyPostCardProps, 'onClick' | 'className'>) {
  const session = atCuteState.value;

  const { data: postData, isLoading: isLoadingPost } = useQuery({
    queryKey: ['post-data', mark.subject_uri],
    queryFn: async () => {
      if (!mark.subject_uri || !session) {
        return null;
      }
      return await fetchPostFromAtUri(mark.subject_uri, session);
    },
    enabled: !!mark.subject_uri && !!session,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  if (isLoadingPost) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 bg-gray-50 dark:bg-gray-800/50 text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Loading post...</span>
        </div>
      </div>
    );
  }

  if (!postData) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-gray-50 dark:bg-gray-800/50 text-center">
        <div className="text-gray-500 dark:text-gray-400">
          <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="text-sm">Unable to load referenced post</div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800/50">
      <ProfilePost post={postData} displayItems={["avatar", "displayName", "handle"]} />
    </div>
  );
}