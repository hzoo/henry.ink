import type { StoredMark } from "@/api/trails/trail-storage";
import type { TrailView } from "@/api/trails/types";
import { formatRelativeTime } from "@/src/lib/trails-signals";

interface MarkPreviewProps {
  mark: StoredMark;
  onClick?: () => void;
}

export function MarkPreview({ mark, onClick }: MarkPreviewProps) {
  const isExternal = mark.subject_type === 'external';
  const title = mark.external_title || mark.note || 'Untitled';
  const url = mark.external_url || mark.subject_uri;
  const domain = isExternal && url 
    ? new URL(url).hostname.replace('www.', '')
    : null;

  const handleClick = (e: Event) => {
    e.stopPropagation(); // Prevent parent trail card from capturing the click
    
    if (onClick) {
      onClick();
    } else if (isExternal && url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div 
      className={`flex-shrink-0 w-32 sm:w-36 h-18 sm:h-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 sm:p-3 transition-colors group ${
        isExternal && url && !onClick 
          ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm' 
          : 'cursor-pointer hover:border-gray-300 dark:hover:border-gray-600'
      }`}
      onClick={handleClick}
    >
      <div className="h-full flex flex-col justify-between">
        <div className="flex-1">
          <h4 className="text-xs font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight">
            {title}
          </h4>
        </div>
        
        <div className="flex items-center justify-between pt-1">
          {domain && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
              {domain}
            </span>
          )}
          
          {isExternal ? (
            <svg className={`w-3 h-3 flex-shrink-0 transition-colors ${
              url && !onClick 
                ? 'text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400'
                : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          ) : (
            <svg className="w-3 h-3 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

interface MarkPreviewsListProps {
  marks: StoredMark[];
  totalCount: number;
  onViewAll?: () => void;
}

export function MarkPreviewsList({ marks, totalCount, onViewAll }: MarkPreviewsListProps) {
  const hasMore = totalCount > marks.length;
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-2 overflow-x-auto pb-1 flex-1">
        {marks.map((mark) => (
          <MarkPreview key={mark.id} mark={mark} />
        ))}
      </div>
      
      {hasMore && (
        <button
          onClick={onViewAll}
          className="flex-shrink-0 flex items-center justify-center w-16 sm:w-20 h-18 sm:h-20 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
        >
          <div className="text-center">
            <div className="text-xs font-medium">+{totalCount - marks.length}</div>
            <div className="text-[10px] mt-0.5">more</div>
          </div>
        </button>
      )}
    </div>
  );
}

interface TrailCardProps {
  trail: any; // Will be properly typed once we update the API
  markCount: number;
  creatorProfile?: {
    avatar?: string;
    displayName?: string;
    handle: string;
  };
}

export function TrailCard({ trail, markCount, creatorProfile }: TrailCardProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6 bg-white dark:bg-gray-800 mb-6 sm:mb-8">
      {/* Trail Header */}
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {trail?.name}
        </h1>
        {trail?.description && (
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
            {trail.description}
          </p>
        )}
      </div>

      {/* Creator Info & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        {/* Creator */}
        {creatorProfile && (
          <div className="flex items-center gap-3">
            {creatorProfile.avatar ? (
              <img
                src={creatorProfile.avatar}
                alt={creatorProfile.displayName || creatorProfile.handle}
                className="w-8 h-8 rounded-full object-cover bg-gray-100 dark:bg-gray-700"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {creatorProfile.displayName || creatorProfile.handle}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                @{creatorProfile.handle}
              </div>
            </div>
          </div>
        )}

        {/* Stats & Dates */}
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span className="font-medium">{markCount}</span> marks
          </div>
          <span>Created {formatRelativeTime(trail?.created_at || '')}</span>
          {trail?.indexed_at !== trail?.created_at && (
            <span>Updated {formatRelativeTime(trail?.indexed_at || '')}</span>
          )}
        </div>
      </div>
    </div>
  );
}