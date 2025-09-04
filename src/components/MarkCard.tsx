import { useQuery } from "@tanstack/react-query";
import type { StoredMark } from "@/api/trails/trail-storage";
import { fetchPostFromAtUri } from "@/src/lib/atproto-post-fetcher";
import { ProfilePost } from "@/henry-ink/components/ProfilePost";
import { atCuteState } from "@/demo/lib/oauth";

interface MarkCardProps {
  mark: StoredMark;
  onClick?: (mark: StoredMark) => void;
}

export function MarkCard({ mark, onClick }: MarkCardProps) {
  const session = atCuteState.value;

  const handleClick = () => {
    if (onClick) {
      onClick(mark);
    } else {
      // Default click behavior
      const isExternal = mark.subject_type === 'external';
      if (isExternal && mark.external_url) {
        window.open(mark.external_url, '_blank');
      }
    }
  };

  const isExternal = mark.subject_type === 'external';
  const isStrongRef = mark.subject_type === 'strongRef';

  // Fetch post data for strongRef marks
  const { data: postData, isLoading: isLoadingPost } = useQuery({
    queryKey: ['post-data', mark.subject_uri],
    queryFn: async () => {
      if (!isStrongRef || !mark.subject_uri || !session) {
        return null;
      }
      return await fetchPostFromAtUri(mark.subject_uri, session);
    },
    enabled: isStrongRef && !!mark.subject_uri && !!session,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // If it's a strongRef and we have post data, render the post in a card
  if (isStrongRef && postData) {
    return (
      <div 
        className="col-span-2 sm:col-span-2 lg:col-span-2 xl:col-span-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer group h-fit"
        onClick={handleClick}
      >
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

  // If it's a strongRef but loading, show loading state
  if (isStrongRef && isLoadingPost) {
    return (
      <div className="col-span-2 sm:col-span-2 lg:col-span-2 xl:col-span-2 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 h-32 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Loading post...</span>
        </div>
      </div>
    );
  }

  // External links or failed strongRef - Are.na-style card
  const title = mark.external_title || mark.external_url || 'Untitled';
  const url = mark.external_url;
  const domain = url ? new URL(url).hostname.replace('www.', '') : null;

  return (
    <div 
      className="col-span-1 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer group h-fit"
      onClick={handleClick}
      title={mark.note || title}
    >
      {/* Mark Type Indicator */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-shrink-0">
          {isExternal ? (
            <div className="w-5 h-5 bg-green-500 rounded-sm flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
              </svg>
            </div>
          ) : (
            <div className="w-5 h-5 bg-purple-500 rounded-sm flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/>
              </svg>
            </div>
          )}
        </div>
        
        {domain && (
          <span className="text-xs text-gray-400 dark:text-gray-500 truncate ml-2">
            {domain}
          </span>
        )}
      </div>
      
      {/* Content */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {title}
        </h3>
        
        {mark.note && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 italic">
              › {mark.note}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}