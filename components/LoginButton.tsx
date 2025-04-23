import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { useAtCute, startLoginProcess, logout } from "@/site/lib/oauth";
// import { useVerifiedUserHandle } from "@/src/hooks/useVerifiedUserHandle"; // Removed unused/incorrect import
import type { JSX } from "preact/jsx-runtime";

// Helper function to generate storage key for the verified handle
const getStorageKey = (did: string) => `bskyUserHandle_${did}`;
const LAST_ENTERED_HANDLE_KEY = "lastEnteredHandle";

export function LoginButton({ minimal = false }: { minimal?: boolean }) {
  const { state: atCuteSignal, isLoading } = useAtCute(); // Renamed state to atCuteSignal for clarity
  // const { userHandle, isFetchingProfile, clearUserHandleCache } = useVerifiedUserHandle(atCuteSignal); // Removed hook usage
  const userHandle = useSignal<string | null>(null); // Added local state for user handle
  const isFetchingProfile = useSignal(false); // Added local state for fetching status
  const handleInput = useSignal("");
  const prevAtCuteValue = useRef(atCuteSignal); // Use the signal object directly

  // Effect to handle pre-filling input and clearing on login
  useEffect(() => {
    const currentAtCute = atCuteSignal; // Access state directly
    if (!currentAtCute) {
      // User is logged out or initial load
      const lastHandle = localStorage.getItem(LAST_ENTERED_HANDLE_KEY);
      if (lastHandle && !handleInput.value) {
        handleInput.value = lastHandle;
      }
      // Clear user handle state if logged out
      userHandle.value = null;
    } else {
      // User is logged in
      if (!prevAtCuteValue.current) { // Check if login just happened
         handleInput.value = ''; // Clear input on login
      }
      // Initialize handle from cache if available
      const cachedHandle = localStorage.getItem(getStorageKey(currentAtCute.session.info.sub));
      if (cachedHandle) {
          userHandle.value = cachedHandle;
      } else {
          userHandle.value = null; // Ensure it's null if not cached
      }
    }
    prevAtCuteValue.current = currentAtCute; // Update previous state ref
  }, [atCuteSignal, handleInput, userHandle]); // Depend on the signal object and local states

  // Effect to fetch profile handle when logged in and handle isn't cached/set
  useEffect(() => {
    const currentAtCute = atCuteSignal; // Access state directly
    if (currentAtCute && !isFetchingProfile.value && !userHandle.value) {
      const did = currentAtCute.session.info.sub;
      const storageKey = getStorageKey(did);

      const fetchProfile = async () => {
        isFetchingProfile.value = true;
        try {
          // Optional: Small delay if needed, e.g., await sleep(100);
          const profile = await currentAtCute.xrpc.get('app.bsky.actor.getProfile', {
            params: { actor: did },
          });
          const fetchedHandle = profile?.data?.handle;
          if (fetchedHandle) {
            userHandle.value = fetchedHandle;
            localStorage.setItem(storageKey, fetchedHandle);
          } else {
            // Handle case where profile fetch succeeds but handle is missing
            localStorage.removeItem(storageKey); // Remove potentially incorrect cache entry
          }
        } catch (error) {
          console.error("Failed to fetch user profile handle:", error);
          localStorage.removeItem(storageKey); // Clear cache on error
          if (error instanceof Error && error.message.includes('invalid_token')) {
             console.error("Authentication error detected during profile fetch, logging out.");
             logout(); // Logout will trigger state change handled by other effect
          }
        } finally {
          isFetchingProfile.value = false;
        }
      };
      fetchProfile();
    }
  }, [atCuteSignal, isFetchingProfile, userHandle]); // Depend on signal object and local states


  const handleSubmit = (e: JSX.TargetedEvent<HTMLFormElement, Event>) => {
    e.preventDefault();
    const handleToLogin = handleInput.value.trim();
    if (handleToLogin) {
      localStorage.setItem(LAST_ENTERED_HANDLE_KEY, handleToLogin);
      startLoginProcess(handleToLogin);
    }
  };

  const handleLogout = () => {
    const currentAtCute = atCuteSignal; // Access state directly
    if (currentAtCute) {
      // Use the helper function to clear the specific user's handle cache
      localStorage.removeItem(getStorageKey(currentAtCute.session.info.sub));
    }
    // Don't clear LAST_ENTERED_HANDLE_KEY on logout
    logout();
  };

  const currentAtCute = atCuteSignal; // Access state directly
  // Determine display name: fetched handle > loading indicator > DID
  const displayName = currentAtCute
    ? userHandle.value || (isFetchingProfile.value ? '...' : currentAtCute.session.info.sub)
    : '';

  return (
    <>
      {isLoading && !currentAtCute && (
         <div className="text-xs text-center text-gray-500 dark:text-gray-400 pb-2">Checking login status...</div>
      )}
      {currentAtCute ? (
        // Updated UI for logged-in state with badge
        <div className="flex items-center justify-between gap-2">
          <span
            className="px-2.5 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full dark:bg-blue-900 dark:text-blue-300 truncate"
            title={currentAtCute.session.info.sub} // Show DID on hover
          >
            {displayName}
          </span>
          <button
            onClick={handleLogout}
            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-md hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900/80 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500/50 transition-colors"
            aria-label="Logout"
          >
            Logout
          </button>
        </div>
      ) : (
        // Logged-out state form remains the same
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
           <div className="flex items-center gap-1">
              <input
                  id="bskyHandle"
                  type="text"
                  value={handleInput.value}
                  onInput={(e) => handleInput.value = (e.target as HTMLInputElement).value}
                  placeholder="yourname.bsky.social"
                  required
                  className="flex-grow px-2 py-1 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  aria-label="Bluesky Handle"
                  disabled={isLoading}
              />
              <button
                  type="submit"
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500/80 disabled:opacity-50"
                  disabled={isLoading}
              >
                  Login
              </button>
           </div>
           {!minimal && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Login to like, reply, repost</p>
           )}
        </form>
      )}
    </>
  );
} 