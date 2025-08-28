import { useAtCute, atCuteState } from "@/demo/lib/oauth";
import { TrailsManager } from "@/src/components/TrailsManager";

export function TrailsPage() {
  useAtCute(); // Initialize OAuth
  
  // Access current auth state (reactive to signal changes)
  // Use atCuteState directly in JSX to make it reactive
  const isLoggedIn = !!atCuteState.value?.session;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Trails
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Create and manage your content collections
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
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {atCuteState.value ? (
          <TrailsManager session={atCuteState.value} />
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Login Required
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                You need to sign in with Bluesky to create and manage trails.
              </p>
              <button
                onClick={() => window.location.href = '/?login=true'}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
              >
                Sign In with Bluesky
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}