import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { useAtCute, startLoginProcess, logout } from "@/site/lib/oauth";
import type { JSX } from "preact/jsx-runtime";
import { sleep } from "@/lib/utils/sleep";

const getStorageKey = (did: string) => `bskyUserHandle_${did}`;
const LAST_ENTERED_HANDLE_KEY = "lastEnteredHandle";

export function LoginButton({ minimal = false }: { minimal?: boolean }) {
  const { state: atCuteSignal, isLoading } = useAtCute();
  const userHandle = useSignal<string | null>(null);
  const isFetchingProfile = useSignal(false);
  const handleInput = useSignal("");
  const prevAtCuteValue = useRef(atCuteSignal);

  useEffect(() => {
    const currentAtCute = atCuteSignal;
    if (!currentAtCute) {
      const lastHandle = localStorage.getItem(LAST_ENTERED_HANDLE_KEY);
      if (lastHandle && !handleInput.value) {
        handleInput.value = lastHandle;
      }
      userHandle.value = null;
    } else {
      if (!prevAtCuteValue.current) {
         handleInput.value = '';
      }
      const cachedHandle = localStorage.getItem(getStorageKey(currentAtCute.session.info.sub));
      if (cachedHandle) {
          userHandle.value = cachedHandle;
      } else {
          userHandle.value = null;
      }
    }
    prevAtCuteValue.current = currentAtCute;
  }, [atCuteSignal, handleInput, userHandle]);

  useEffect(() => {
    const currentAtCute = atCuteSignal;
    if (currentAtCute && !isFetchingProfile.value && !userHandle.value) {
      const did = currentAtCute.session.info.sub;
      const storageKey = getStorageKey(did);

      const fetchProfile = async () => {
        isFetchingProfile.value = true;
        try {
          await sleep(100);
          const profile = await currentAtCute.xrpc.get('app.bsky.actor.getProfile', {
            params: { actor: did },
          });
          const fetchedHandle = profile?.data?.handle;
          if (fetchedHandle) {
            userHandle.value = fetchedHandle;
            localStorage.setItem(storageKey, fetchedHandle);
          } else {
            localStorage.removeItem(storageKey);
          }
        } catch (error) {
          console.error("Failed to fetch user profile handle:", error);
          localStorage.removeItem(storageKey);
          if (error instanceof Error && error.message.includes('invalid_token')) {
             console.error("Authentication error detected during profile fetch, logging out.");
             logout();
          }
        } finally {
          isFetchingProfile.value = false;
        }
      };
      fetchProfile();
    }
  }, [atCuteSignal, isFetchingProfile, userHandle]);


  const handleSubmit = (e: JSX.TargetedEvent<HTMLFormElement, Event>) => {
    e.preventDefault();
    const handleToLogin = handleInput.value.trim();
    if (handleToLogin) {
      localStorage.setItem(LAST_ENTERED_HANDLE_KEY, handleToLogin);
      startLoginProcess(handleToLogin);
    }
  };

  const handleLogout = () => {
    const currentAtCute = atCuteSignal;
    if (currentAtCute) {
      localStorage.removeItem(getStorageKey(currentAtCute.session.info.sub));
    }
    logout();
  };

  const currentAtCute = atCuteSignal;
  const displayName = currentAtCute
    ? userHandle.value || (isFetchingProfile.value ? '...' : currentAtCute.session.info.sub)
    : '';

  return (
    <>
      {isLoading && !currentAtCute && (
         <div className="text-xs text-center text-gray-500 dark:text-gray-400 pb-2">Checking login status...</div>
      )}  
      {currentAtCute ? (
        <div className="flex items-center justify-between gap-2">
          <span
            className="px-2.5 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full dark:bg-blue-900 dark:text-blue-300 truncate"
            title={currentAtCute.session.info.sub}
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