import { useAtCute } from "@/demo/lib/oauth";
import { useEffect } from "preact/hooks";
import { 
  searchQuery, 
  sortBy, 
  filteredTrails,
  trailsLoading,
  trailsError,
  navigateToTrail,
  formatRelativeTime,
  getSortLabel,
  setSearchQuery,
  setSortBy
} from "@/src/lib/trails-signals";
import { fetchAllTrails, refreshTrailsData } from "@/src/lib/trails-api";

export function TrailsPage() {
  useAtCute(); // Initialize OAuth for profile links
  
  // Fetch trails on mount and when search/sort changes
  useEffect(() => {
    const params: any = { limit: 100 };
    if (searchQuery.value.trim()) {
      params.search = searchQuery.value.trim();
    }
    
    fetchAllTrails(params).catch(error => {
      console.error('Failed to fetch trails:', error);
    });
  }, [searchQuery.value, sortBy.value]);

  const handleTrailClick = (trail: any) => {
    // Navigate to the trail author's profile and trail detail
    const authorIdentifier = trail.author_did;
    const rkey = trail.uri.split('/').pop();
    if (rkey && authorIdentifier) {
      navigateToTrail(authorIdentifier, rkey);
    }
  };

  const handleRefresh = () => {
    refreshTrailsData();
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Trails Explorer
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Discover content collections from the community
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <a
                href="/"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Henry's Note
              </a>
            </div>
          </div>

          {/* Search and Sort Controls */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search trails..."
                value={searchQuery.value}
                onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <select
              value={sortBy.value}
              onChange={(e) => setSortBy((e.target as HTMLSelectElement).value as 'recent' | 'marks' | 'updated')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="recent">Recently Created</option>
              <option value="marks">Most Marks</option>
              <option value="updated">Recently Updated</option>
            </select>

            {!trailsLoading.value && (
              <button
                onClick={handleRefresh}
                className="px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                title="Refresh"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {trailsError.value ? (
          <div className="text-center py-12">
            <div className="text-red-600 dark:text-red-400 text-sm mb-4">
              {trailsError.value}
            </div>
            <button
              onClick={handleRefresh}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm underline"
            >
              Try again
            </button>
          </div>
        ) : trailsLoading.value ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32 mb-1"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                  </div>
                </div>
                <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-48 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
              </div>
            ))}
          </div>
        ) : filteredTrails.value.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 mx-auto">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {searchQuery.value ? 'No trails found' : 'No trails yet'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchQuery.value ? 
                `No trails match "${searchQuery.value}". Try different keywords.` :
                'Be the first to create a trail using the bookmarklet or quick mark tool!'
              }
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              {filteredTrails.value.length} trail{filteredTrails.value.length !== 1 ? 's' : ''} • Sorted by {getSortLabel.value}
            </div>
            
            <div className="space-y-4">
              {filteredTrails.value.map((trail) => (
                <div
                  key={trail.uri}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer group"
                  onClick={() => handleTrailClick(trail)}
                >
                  {/* Author info */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {trail.creator.did}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {trail.creator.did.slice(-12)}...
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      {trail.markCount || 0} marks
                    </div>
                  </div>

                  {/* Trail content */}
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-2">
                    {trail.name}
                  </h3>
                  
                  {trail.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                      {trail.description}
                    </p>
                  )}
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Created {formatRelativeTime(trail.createdAt)}
                    {trail.indexedAt !== trail.createdAt && (
                      <span className="ml-3">
                        Updated {formatRelativeTime(trail.indexedAt)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}