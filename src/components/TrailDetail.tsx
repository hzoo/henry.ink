import { useQuery } from "@tanstack/react-query";
import { MarkItem } from "@/src/components/TrailItem";
import type { StoredTrail, StoredMark } from "@/api/trails/trail-storage";

interface TrailDetailProps {
  trailUri: string;
  onClose?: () => void;
  onMarkClick?: (mark: StoredMark) => void;
}

export function TrailDetail({ trailUri, onClose, onMarkClick }: TrailDetailProps) {
  // Fetch trail with marks
  const { 
    data: trailData, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['trail-detail', trailUri],
    queryFn: async () => {
      const response = await fetch(`/api/trails/${encodeURIComponent(trailUri)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch trail');
      }
      return response.json() as { trail: StoredTrail; marks: StoredMark[] };
    },
    staleTime: 30 * 1000, // 30 seconds - shorter cache for testing
    retry: 2,
    refetchOnWindowFocus: true,
  });

  const trail = trailData?.trail;
  const marks = trailData?.marks || [];

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (error) {
    return (
      <div className="flex flex-col h-full">
        {/* Header with close button */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Trail Detail
            </h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Error content */}
        <div className="flex-grow flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-red-600 dark:text-red-400 text-sm mb-2">
              {error instanceof Error ? error.message : 'Failed to load trail'}
            </div>
            <button
              onClick={() => refetch()}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        {/* Header with close button */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Trail Detail
            </h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Loading content */}
        <div className="flex-grow flex items-center justify-center">
          <div className="flex items-center">
            <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              Loading trail...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!trail) {
    return (
      <div className="flex flex-col h-full">
        {/* Header with close button */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Trail Detail
            </h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Not found content */}
        <div className="flex-grow flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-gray-500 dark:text-gray-400 text-sm">
              Trail not found
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-start justify-between">
          <div className="flex-grow mr-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
              {trail.name}
            </h2>
            {trail.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {trail.description}
              </p>
            )}
            <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mt-2">
              <span>Created {formatDateTime(trail.created_at)}</span>
              <span>{marks.length} marks</span>
            </div>
          </div>
          
          {onClose && (
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Marks */}
      <div className="flex-grow overflow-y-auto">
        {marks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No marks yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              This trail doesn't have any marks yet. Add some content to get started.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {marks.map((mark) => (
              <MarkItem
                key={mark.id}
                mark={mark}
                onClick={onMarkClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with actions */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {marks.length} {marks.length === 1 ? 'mark' : 'marks'}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}