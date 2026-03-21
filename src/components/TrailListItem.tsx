import { formatRelativeTime } from "@/src/lib/trails-signals";
import type { TrailView } from "@/api/trails/types";

interface TrailListItemProps {
  trail: TrailView;
  onTrailClick: (trail: TrailView) => void;
}

export function TrailListItem({ trail, onTrailClick }: TrailListItemProps) {
  return (
    <div 
      className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg cursor-pointer transition-colors group"
      onClick={() => onTrailClick(trail)}
    >
      {/* Left: Trail name */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {trail.name}
        </h3>
        {/* Optional description - only show if exists and space allows */}
        {trail.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {trail.description}
          </p>
        )}
      </div>
      
      {/* Center: Mark count */}
      <div className="text-xs text-gray-500 dark:text-gray-400 px-4 flex-shrink-0">
        {trail.markCount || 0} marks
      </div>
      
      {/* Right: Last updated */}
      <div className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
        {trail.indexedAt !== trail.createdAt 
          ? `Updated ${formatRelativeTime(trail.indexedAt)}`
          : `Created ${formatRelativeTime(trail.createdAt)}`
        }
      </div>
    </div>
  );
}