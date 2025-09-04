import { useEffect } from "preact/hooks";
import { atCuteState } from "@/demo/lib/oauth";
import {
  currentUserDid,
  currentUsername,
  profileTrails,
  trailsLoading,
  trailsError,
  navigateToTrail,
  formatRelativeTime,
  scrollToElement
} from "@/src/lib/trails-signals";
import { fetchUserTrails } from "@/src/lib/trails-api";
import { TrailListItem } from "@/src/components/TrailListItem";

export function ProfileTrails() {
  const session = atCuteState.value;
  
  // Always use API for now since it provides mark counts
  // Could use PDS for real-time updates but would need to fetch mark counts separately
  const usePDS = false;

  // Fetch trails when user DID changes
  useEffect(() => {
    if (currentUserDid.value && currentUsername.value) {
      fetchUserTrails(
        currentUserDid.value, 
        currentUsername.value, 
        session, 
        usePDS
      );
    }
  }, [currentUserDid.value, currentUsername.value, session]);

  const handleTrailClick = (trail: any) => {
    const rkey = trail.uri.split('/').pop();
    if (rkey && currentUsername.value) {
      navigateToTrail(currentUsername.value, rkey);
    }
  };

  if (trailsError.value) {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Trails
          </h2>
        </div>
        <div className="p-4 text-center text-red-600 dark:text-red-400 text-sm">
          {trailsError.value}
        </div>
      </div>
    );
  }

  return (
    <div id="trails" className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Trails
          {profileTrails.value.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              ({profileTrails.value.length})
            </span>
          )}
        </h2>
        {profileTrails.value.length > 0 && (
          <a 
            href="/trails"
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            Explore all trails →
          </a>
        )}
      </div>

      {trailsLoading.value ? (
        // Loading state for dense list
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 animate-pulse">
              <div className="flex-1">
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-32 mb-1"></div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-16 mx-4"></div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
            </div>
          ))}
        </div>
      ) : profileTrails.value.length === 0 ? (
        // Empty state
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 mx-auto">
            <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No trails yet. Use the{" "}
            <a 
              href="/tools/quick-mark" 
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              quick mark tool
            </a>
            {" "}to create your first trail.
          </p>
        </div>
      ) : (
        // Arena-style dense trails list
        <div className="space-y-1">
          {profileTrails.value.map((trail: any) => (
            <TrailListItem
              key={trail.uri}
              trail={trail}
              onTrailClick={handleTrailClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}