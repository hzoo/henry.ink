import { useRoute } from "preact-iso";
import { TrailList } from "@/src/components/TrailList";
import type { TrailView } from "@/api/trails/types";
import { searchQuery, authorFilter, navigateToTrail } from "@/src/lib/trails-signals";

interface TrailsManagerProps {
  session?: any; // AT Protocol state (full atCuteState)
  className?: string;
}

export function TrailsManager({ 
  session, 
  className = ''
}: TrailsManagerProps) {
  const currentUserDid = session?.session?.info?.sub;
  const route = useRoute();
  
  // Extract username from route for navigation
  const username = route.params?.username as string;

  const handleTrailClick = (trail: TrailView) => {
    // Extract rkey from trail URI: at://did/ink.henry.annoate.trail/rkey
    const rkey = trail.uri.split('/').pop();
    if (rkey && username) {
      // Navigate to the trail detail route
      navigateToTrail(username, rkey);
    }
  };

  const handleCreateTrail = () => {
    // Navigate to Quick Mark with create trail mode
    window.location.href = '/tools/quick-mark?create=true';
  };

  // Set author filter based on selection
  const filterAuthor = authorFilter.value === currentUserDid ? 'mine' : 'all';
  const actualAuthorFilter = filterAuthor === 'mine' && currentUserDid ? currentUserDid : undefined;

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Trails
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search trails..."
                value={searchQuery.value}
                onChange={(e) => searchQuery.value = (e.target as HTMLInputElement).value}
                className="w-48 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="absolute right-2.5 top-2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filter */}
            {currentUserDid && (
              <select
                value={filterAuthor}
                onChange={(e) => {
                  const value = (e.target as HTMLSelectElement).value as 'all' | 'mine';
                  authorFilter.value = value === 'mine' && currentUserDid ? currentUserDid : null;
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Trails</option>
                <option value="mine">My Trails</option>
              </select>
            )}

            {/* Create button */}
            {currentUserDid && (
              <button
                onClick={handleCreateTrail}
                className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Trail
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow overflow-hidden">
        <TrailList
          authorDid={actualAuthorFilter}
          searchQuery={searchQuery.value || undefined}
          showMarkPreviews={false}
          onTrailClick={handleTrailClick}
          session={session}
        />
      </div>
    </div>
  );
}