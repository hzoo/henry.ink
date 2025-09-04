import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { MarkCard } from "@/src/components/MarkCard";
import { TrailCard } from "@/src/components/MarkPreview";
import { 
  currentTrailData,
  trailsLoading,
  trailsError,
  clearTrailsError
} from "@/src/lib/trails-signals";
import { fetchTrailDetail } from "@/src/lib/trails-api";

interface TrailDetailProps {
  trailUri: string;
  onMarkClick?: (mark: any) => void;
  session?: any; // AT Protocol session - for real-time trail updates
}

export function TrailDetail({ trailUri, onMarkClick, session }: TrailDetailProps) {
  const currentPage = useSignal(0);
  const allMarks = useSignal<any[]>([]);
  const hasMoreMarks = useSignal(true);
  const loadingMore = useSignal(false);

  // Fetch trail detail when component mounts or trailUri changes
  useEffect(() => {
    if (trailUri) {
      // Reset pagination state
      currentPage.value = 0;
      allMarks.value = [];
      hasMoreMarks.value = true;
      fetchTrailDetail(trailUri, session);
    }
  }, [trailUri, session]);

  // Update allMarks when currentTrailData changes
  useEffect(() => {
    if (currentTrailData.value?.marks) {
      if (currentPage.value === 0) {
        // First load - replace all marks
        allMarks.value = currentTrailData.value.marks;
      } else {
        // Load more - append new marks
        const newMarks = currentTrailData.value.marks;
        allMarks.value = [...allMarks.value, ...newMarks];
      }
      
      // Check if we have fewer marks than requested (means no more available)
      if (currentTrailData.value.marks.length < 25) {
        hasMoreMarks.value = false;
      }
      
      loadingMore.value = false;
    }
  }, [currentTrailData.value]);

  const trail = currentTrailData.value?.trail;
  const marks = allMarks.value;

  const handleRetry = () => {
    clearTrailsError();
    currentPage.value = 0;
    allMarks.value = [];
    hasMoreMarks.value = true;
    fetchTrailDetail(trailUri, session);
  };

  const handleLoadMore = async () => {
    if (loadingMore.value || !hasMoreMarks.value) return;
    
    loadingMore.value = true;
    const nextPage = currentPage.value + 1;
    currentPage.value = nextPage;
    
    try {
      await fetchTrailDetail(trailUri, session, 25, nextPage * 25);
    } catch (error) {
      console.error('Failed to load more marks:', error);
      loadingMore.value = false;
      currentPage.value = currentPage.value - 1; // Revert page increment
    }
  };

  if (trailsError.value) {
    return (
      <div className="text-center p-8">
        <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl">
          <div className="flex items-center justify-center">
            <svg
              className="w-5 h-5 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium">Error:</span>
            <span className="ml-1">{trailsError.value}</span>
          </div>
        </div>
        <button
          onClick={handleRetry}
          className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!trail && !trailsError.value) {
    return (
      <div className="text-center p-8 flex flex-col items-center justify-center space-y-2">
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
          <svg
            className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading trail...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Trail Card Header */}
      <TrailCard
        trail={trail}
        markCount={marks.length}
        creatorProfile={trail?.creator ? {
          avatar: trail.creator.avatar,
          displayName: trail.creator.displayName,
          handle: trail.creator.handle
        } : undefined}
      />

      {/* Marks Grid */}
      {marks.length === 0 ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 mx-auto">
            <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No marks yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Start adding marks to this trail using the{" "}
            <a 
              href="/tools/quick-mark" 
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              quick mark tool
            </a>
            {" "}or bookmarklet.
          </p>
        </div>
      ) : (
        <>
          {/* Are.na-style responsive grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {marks.map((mark) => (
              <MarkCard
                key={mark.id}
                mark={mark}
                onClick={(mark) => onMarkClick && onMarkClick(mark)}
              />
            ))}
          </div>

          {/* Load More button */}
          {hasMoreMarks.value && marks.length >= 25 && (
            <div className="text-center pt-4">
              <button 
                className="px-6 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleLoadMore}
                disabled={loadingMore.value}
              >
                {loadingMore.value ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                ) : (
                  'Load More Marks'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}