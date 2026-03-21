import { useEffect } from "preact/hooks";
import { useSignal, useComputed } from "@preact/signals";
import { TrailItem } from "@/src/components/TrailItem";
import type { TrailView } from "@/api/trails/types";
import { fetchAllTrails, fetchUserTrails } from "@/src/lib/trails-api";

interface TrailListProps {
  authorDid?: string;
  searchQuery?: string;
  showMarkPreviews?: boolean;
  onTrailClick?: (trail: TrailView) => void;
  session?: any; // AT Protocol session - when provided, fetches directly from PDS
}

export function TrailList({ 
  authorDid, 
  searchQuery, 
  showMarkPreviews = false, 
  onTrailClick,
  session
}: TrailListProps) {
  const trails = useSignal<TrailView[]>([]);
  const isLoading = useSignal(false);
  const error = useSignal<string | null>(null);
  const limit = useSignal(20);
  const offset = useSignal(0);

  // Determine if we should use PDS for current user's trails
  const usePDS = useComputed(() => 
    session?.rpc && authorDid === session.session?.info?.sub
  );

  // Fetch trails when parameters change
  useEffect(() => {
    const fetchTrails = async () => {
      isLoading.value = true;
      error.value = null;
      
      try {
        let fetchedTrails: TrailView[];
        
        if (usePDS.value && session?.rpc && session?.session?.info?.sub) {
          // Fetch directly from PDS for current user's trails
          const authorDid = session.session.info.sub;
          const username = session.session.info.handle || authorDid;
          fetchedTrails = await fetchUserTrails(authorDid, username, session, true);
        } else {
          // Fallback to API
          const params: any = {
            limit: limit.value,
            offset: offset.value
          };
          if (authorDid) params.author_did = authorDid;
          if (searchQuery) params.search = searchQuery;
          
          fetchedTrails = await fetchAllTrails(params);
        }
        
        // Handle pagination - append or replace based on offset
        if (offset.value === 0) {
          trails.value = fetchedTrails;
        } else {
          trails.value = [...trails.value, ...fetchedTrails];
        }
      } catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to fetch trails';
        console.error('Failed to fetch trails in TrailList:', err);
      } finally {
        isLoading.value = false;
      }
    };

    fetchTrails();
  }, [authorDid, searchQuery, limit.value, offset.value, usePDS.value, session]);

  const handleLoadMore = () => {
    offset.value += limit.value;
  };

  const handleRefresh = () => {
    offset.value = 0; // This will trigger the useEffect to refetch
  };

  if (error.value) {
    return (
      <div className="p-4 text-center">
        <div className="text-red-600 dark:text-red-400 text-sm mb-2">
          {error.value}
        </div>
        <button
          onClick={handleRefresh}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {searchQuery ? `Search: "${searchQuery}"` : 
             authorDid ? 'My Trails' : 
             'All Trails'}
          </h2>
          
          {!isLoading.value && (
            <button
              onClick={handleRefresh}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow overflow-y-auto">
        {isLoading.value && offset.value === 0 ? (
          // Initial loading
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              Loading trails...
            </span>
          </div>
        ) : trails.value.length === 0 && !isLoading.value ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {searchQuery ? 'No trails found' : 'No trails yet'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              {searchQuery ? 
                `No trails match "${searchQuery}". Try different keywords.` :
                authorDid ?
                  'Create your first trail to get started.' :
                  'No trails have been created yet.'
              }
            </p>
          </div>
        ) : (
          // Trails list
          <div>
            {trails.value.map((trail: TrailView) => (
              <TrailItem
                key={trail.uri}
                trail={trail}
                showMarks={showMarkPreviews}
                onClick={onTrailClick}
              />
            ))}
            
            {/* Load more button */}
            {trails.value.length >= limit.value && (
              <div className="p-4 text-center border-t border-gray-200 dark:border-gray-700">
                {isLoading.value ? (
                  <div className="flex items-center justify-center">
                    <div className="w-3 h-3 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                      Loading more...
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleLoadMore}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium transition-colors"
                  >
                    Load more trails
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}