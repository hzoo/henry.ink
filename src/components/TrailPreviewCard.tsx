import { useTrailMarkPreviews } from "@/src/hooks/useTrailMarkPreviews";
import { MarkPreviewsList } from "@/src/components/MarkPreview";
import { formatRelativeTime } from "@/src/lib/trails-signals";
import type { TrailView } from "@/api/trails/types";

interface TrailPreviewCardProps {
  trail: TrailView;
  onTrailClick: (trail: TrailView) => void;
}

export function TrailPreviewCard({ trail, onTrailClick }: TrailPreviewCardProps) {
  const { data: markPreviews, isLoading: isLoadingPreviews } = useTrailMarkPreviews(trail.uri, 5);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      {/* Trail Header */}
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => onTrailClick(trail)}
            className="text-left group w-full"
          >
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {trail.name}
            </h3>
          </button>
          {trail.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {trail.description}
            </p>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 ml-3 sm:ml-4 flex-shrink-0">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          {trail.markCount || 0} marks
        </div>
      </div>

      {/* Mark Previews Loading Skeleton */}
      {isLoadingPreviews && (trail.markCount > 0) && (
        <div className="mb-3 space-y-2">
          {[...Array(Math.min(3, trail.markCount || 0))].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 animate-pulse">
              <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="flex-1 space-y-1">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Mark Previews */}
      {markPreviews && markPreviews.length > 0 && (
        <div className="mb-3">
          <MarkPreviewsList 
            marks={markPreviews}
            totalCount={trail.markCount || 0}
            onViewAll={() => onTrailClick(trail)}
          />
        </div>
      )}

      {/* Trail Footer */}
      <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
        <div className="flex flex-col sm:flex-row sm:items-center">
          <span>Created {formatRelativeTime(trail.createdAt)}</span>
          {trail.indexedAt !== trail.createdAt && (
            <span className="sm:ml-3">
              Updated {formatRelativeTime(trail.indexedAt)}
            </span>
          )}
        </div>
        
        <button
          onClick={() => onTrailClick(trail)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1 self-start sm:self-auto"
        >
          View trail
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}