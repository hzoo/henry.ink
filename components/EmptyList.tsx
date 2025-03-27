import { autoFetchEnabled } from "@/lib/settings";
import { ManualFetchButton } from "@/components/ManualFetchButton";
import { WhitelistButton } from "@/components/WhitelistButton";
import { isWhitelisted, currentDomain } from "@/lib/messaging";

export function EmptyList() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
      <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-3 mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </div>
      
      {autoFetchEnabled.value ? (
        <>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            {isWhitelisted.value ? 
              "No posts found yet" :
              "Enable auto-search for this site?"
            }
          </h3>
          {isWhitelisted.value ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              No one has shared this page on Bluesky yet. Be the first!
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                To protect your privacy, auto-search needs to be enabled for this site ({currentDomain.value}).
              </p>
              <WhitelistButton />
            </>
          )}
        </>
      ) : (
        <>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Manual mode
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Search Bluesky for posts about {currentDomain.value}
          </p>
          <ManualFetchButton />
        </>
      )}
    </div>
  );
} 