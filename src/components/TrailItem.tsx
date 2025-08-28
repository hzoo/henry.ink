import { useQuery } from "@tanstack/react-query";
import type { StoredTrail, StoredMark, TrailView } from "@/api/trails/trail-storage";

interface TrailItemProps {
  trail: TrailView;
  showMarks?: boolean;
  onClick?: (trail: TrailView) => void;
}

interface MarkItemProps {
  mark: StoredMark;
  onClick?: (mark: StoredMark) => void;
}

export function MarkItem({ mark, onClick }: MarkItemProps) {
  const handleClick = () => {
    onClick?.(mark);
  };

  const isExternal = mark.subject_type === 'external';
  const isStrongRef = mark.subject_type === 'strongRef';

  return (
    <div
      className="cursor-pointer group p-2 bg-gray-50 dark:bg-gray-800/50 rounded border-l-4 border-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
      onClick={handleClick}
      title={mark.note || 'No annotation'}
    >
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0">
          {isExternal && (
            <div className="w-4 h-4 bg-green-500 rounded-sm flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          {isStrongRef && (
            <div className="w-4 h-4 bg-purple-500 rounded-sm flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/>
              </svg>
            </div>
          )}
        </div>
        
        <div className="flex-grow min-w-0">
          {/* Subject info */}
          <div className="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2">
            {isExternal && (mark.external_title || mark.external_url)}
            {isStrongRef && mark.subject_uri}
          </div>
          
          {/* External description or note */}
          {(mark.external_description || mark.note) && (
            <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
              {mark.external_description || mark.note}
            </div>
          )}
          
          {/* Domain for external links */}
          {isExternal && mark.external_url && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {new URL(mark.external_url).hostname}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TrailItem({ trail, showMarks = false, onClick }: TrailItemProps) {
  // Fetch marks for this trail if requested
  const { data: trailWithMarks, isLoading, error } = useQuery({
    queryKey: ['trail-marks', trail.uri],
    queryFn: async () => {
      const response = await fetch(`/api/trails/${encodeURIComponent(trail.uri)}`);
      if (!response.ok) throw new Error('Failed to fetch trail marks');
      return response.json() as { trail: StoredTrail; marks: StoredMark[] };
    },
    enabled: showMarks,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const marks = trailWithMarks?.marks || [];

  const handleTrailClick = () => {
    onClick?.(trail);
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'now';
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d`;
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths}mo`;
    
    const diffInYears = Math.floor(diffInMonths / 12);
    return `${diffInYears}y`;
  };

  return (
    <div className="p-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
      {/* Trail Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-grow">
          <button
            onClick={handleTrailClick}
            className="text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm leading-tight hover:underline text-left"
          >
            {trail.name}
          </button>
          
          {trail.description && (
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {trail.description}
            </div>
          )}
        </div>
        
        <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
          {trail.mark_count} marks
        </div>
      </div>

      {/* Metadata */}
      <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mb-2">
        <span>Created {formatRelativeTime(trail.created_at)} ago</span>
        {trail.latest_mark_at && (
          <span>Latest mark {formatRelativeTime(trail.latest_mark_at)} ago</span>
        )}
      </div>

      {/* Marks Preview - Only if requested */}
      {showMarks && (
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-3 h-3 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                Loading marks...
              </span>
            </div>
          ) : error ? (
            <div className="text-xs text-gray-500 dark:text-gray-400 italic py-2">
              Failed to load marks
            </div>
          ) : marks.length > 0 ? (
            <div className="space-y-2">
              {marks.slice(0, 3).map((mark) => (
                <MarkItem key={mark.id} mark={mark} />
              ))}
              {marks.length > 3 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-1">
                  +{marks.length - 3} more marks...
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-500 dark:text-gray-400 italic py-2">
              No marks yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}