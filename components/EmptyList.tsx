import { autoFetchEnabled } from "@/lib/settings";
import { ManualFetchButton } from "@/components/ManualFetchButton";
import { WhitelistButton } from "@/components/WhitelistButton";
import { isWhitelisted, currentDomain } from "@/lib/messaging";

export function EmptyList() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
      <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-3 mb-4">
        <Icon name="comment" className="h-6 w-6 text-gray-900 dark:text-gray-100" />
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
              <div className="space-y-2 flex flex-col items-center">
                <WhitelistButton />
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                  Or search manually without whitelisting:
                </div>
                <ManualFetchButton />
              </div>
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