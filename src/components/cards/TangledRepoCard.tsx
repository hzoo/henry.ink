/**
 * Tangled repository card component
 * Renders Tangled.sh repositories with GitHub-like styling
 */
import { useQuery } from "@tanstack/react-query";
import type { StoredMark } from "@/api/trails/trail-storage";
import { fetchTangledRepo } from "@/src/lib/tangled-fetcher";
import { atCuteState } from "@/demo/lib/oauth";

interface TangledRepoCardProps {
  url: string;
  mark: StoredMark;
  onClick?: (mark: StoredMark) => void;
  className?: string;
  handle: string;
  rkey: string;
}

export function TangledRepoCard({ url, mark, onClick, className, handle, rkey }: TangledRepoCardProps) {
  const session = atCuteState.value;

  // Fetch real repository data
  const { data: repoData, isLoading } = useQuery({
    queryKey: ['tangled-repo', url],
    queryFn: () => fetchTangledRepo(url, session),
    staleTime: 10 * 60 * 1000, // 10 minutes cache
  });

  const handleClick = () => {
    if (onClick) {
      onClick(mark);
    } else {
      // Default: open Tangled repo in new tab
      window.open(url, '_blank');
    }
  };

  // Use real data when available, fallback to parsed info
  const repoName = repoData?.name || mark.external_title || rkey || 'Repository';
  const repoOwner = repoData?.owner || handle;
  const repoDescription = repoData?.description;
  const isForked = Boolean(repoData?.source);

  // Show loading state
  if (isLoading) {
    return (
      <div className={`col-span-1 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-4 h-32 flex items-center justify-center ${className || ''}`}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Loading repository...</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`col-span-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer group h-fit ${className || ''}`}
      onClick={handleClick}
      title={mark.note || `${repoOwner}/${repoName}`}
    >
      {/* Note at top with purple styling */}
      {mark.note && (
        <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/10 border-b border-purple-100 dark:border-purple-800/30">
          <div className="text-xs text-purple-700 dark:text-purple-300 line-clamp-2">
            › {mark.note}
          </div>
        </div>
      )}
      
      <div className="p-4">
        {/* Repository Header */}
        <div className="flex items-center gap-2 mb-3">
          {/* Book/Fork icon - dynamic based on whether it's forked */}
          <div className="flex-shrink-0">
            {isForked ? (
              // Fork icon
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <circle cx="12" cy="18" r="3"/>
                <circle cx="6" cy="6" r="3"/>
                <circle cx="18" cy="6" r="3"/>
                <path d="m18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/>
                <path d="M12 12v3"/>
              </svg>
            ) : (
              // Book-marked icon for regular repos
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M10 2v8l3-3 3 3V2"/>
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>
              </svg>
            )}
          </div>
          
          {/* Repository name */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {repoOwner}/{repoName}
            </div>
          </div>
        </div>
        
        {/* Repository description (if available from real data) */}
        {repoDescription && (
          <div className="mb-3">
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
              {repoDescription}
            </p>
          </div>
        )}
        
      </div>
    </div>
  );
}

/**
 * Modal version of TangledRepoCard for detailed view
 */
export function TangledRepoCardModal({ url, mark, handle, rkey }: Omit<TangledRepoCardProps, 'onClick' | 'className'>) {
  const session = atCuteState.value;

  // Fetch real repository data (same as card version)
  const { data: repoData, isLoading } = useQuery({
    queryKey: ['tangled-repo', url],
    queryFn: () => fetchTangledRepo(url, session),
    staleTime: 10 * 60 * 1000, // 10 minutes cache
  });

  const handleOpenUrl = () => {
    window.open(url, '_blank');
  };

  // Use real data when available, fallback to parsed info
  const repoName = repoData?.name || mark.external_title || rkey || 'Repository';
  const repoOwner = repoData?.owner || handle;
  const repoDescription = repoData?.description;
  const isForked = Boolean(repoData?.source);

  if (isLoading) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 bg-gray-50 dark:bg-gray-800/50 text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Loading repository...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800/50">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              {/* Dynamic icon based on fork status */}
              {isForked ? (
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <circle cx="12" cy="18" r="3"/>
                  <circle cx="6" cy="6" r="3"/>
                  <circle cx="18" cy="6" r="3"/>
                  <path d="m18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/>
                  <path d="M12 12v3"/>
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M10 2v8l3-3 3 3V2"/>
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>
                </svg>
              )}
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Tangled Repository {isForked && '(Fork)'}
              </span>
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {repoOwner}/{repoName}
            </h3>
            
            {/* Description from real data */}
            {repoDescription && (
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {repoDescription}
              </div>
            )}
            
            <div className="text-sm text-gray-600 dark:text-gray-400 break-all font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded">
              {url}
            </div>
          </div>
          
          <button
            onClick={handleOpenUrl}
            className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors font-medium"
          >
            View Repository
          </button>
        </div>
      </div>
    </div>
  );
}