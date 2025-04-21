import { signal } from "@preact/signals";
import { XRPC } from "@atcute/client";
import {
  configureOAuth,
  createAuthorizationUrl,
  finalizeAuthorization,
  getSession,
  deleteStoredSession,
  OAuthUserAgent,
  resolveFromIdentity,
} from "@atcute/oauth-browser-client";
import { useEffect, useState } from "preact/hooks";

// --- Utils ---
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function initializeOAuth() {
	if (typeof window !== "undefined") {
		configureOAuth({
			metadata: {
				client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
				redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
			},
		});
	}
}

// Infer the session type from the function's return type
type AtCuteSessionData = Awaited<ReturnType<typeof finalizeAuthorization>>;

// --- State Management ---
export interface AtCuteState {
	agent: OAuthUserAgent;
	xrpc: XRPC;
	session: AtCuteSessionData; // Use the inferred type
}

export const atCuteState = signal<AtCuteState | null>(null);
export const isLoadingSession = signal(true); // Track loading state

// --- Hooks ---
export const useAtCute = () => {
	const [isProcessingLogin, setIsProcessingLogin] = useState(false);

	useEffect(() => {
		let isMounted = true;
		isLoadingSession.value = true;

		const processLoginOrLoadSession = async () => {
			// 1. Check if returning from OAuth provider
            if (location.hash.includes("state=") || location.search.includes("code=")) {
                setIsProcessingLogin(true);
                try {
                    const params = new URLSearchParams(location.hash ? location.hash.slice(1) : location.search);
                    history.replaceState(null, "", location.pathname);
                    const session = await finalizeAuthorization(params);
                    const agent = new OAuthUserAgent(session);
                    const xrpc = new XRPC({ handler: agent });
                    if (isMounted) {
                        atCuteState.value = { agent, xrpc, session };
                        localStorage.setItem("atcute-oauth:did", session.info.sub);
                    }
                } catch (error) {
                    // This log is already here, make sure it's not firing silently
                    console.error("OAuth finalization error:", error);
                    localStorage.removeItem("atcute-oauth:did");
                } finally {
                     if (isMounted) {
                        setIsProcessingLogin(false);
                        isLoadingSession.value = false;
                     }
                }
                return;
            }

			// 2. Check for existing persisted session
			const persistedDid = localStorage.getItem("atcute-oauth:did");
			if (persistedDid) {
				try {
                    console.log(`Attempting to load session for persisted DID: ${persistedDid}`);
					const session = await getSession(persistedDid as `did:${string}:${string}`, { allowStale: false });
					if (session && isMounted) {
                        console.log("Successfully loaded/refreshed session:", session.info);
						const agent = new OAuthUserAgent(session);
						const xrpc = new XRPC({ handler: agent });
						atCuteState.value = { agent, xrpc, session };
					} else if (!session) {
						// Session might be invalid or expired and couldn't be refreshed
                        console.warn("getSession returned null (likely refresh failure), clearing potentially invalid session for DID:", persistedDid);
						localStorage.removeItem("atcute-oauth:did");
                        // Also try clearing the library's internal storage for this DID
                        try {
                            deleteStoredSession(persistedDid as `did:${string}:${string}`);
                            console.log("Called deleteStoredSession for potentially invalid DID:", persistedDid);
                        } catch (deleteErr) {
                            console.error("Error calling deleteStoredSession:", deleteErr);
                        }
						if (isMounted) atCuteState.value = null;
					}
				} catch (error) {
					console.error(`Error during getSession for DID ${persistedDid}:`, error);
					localStorage.removeItem("atcute-oauth:did"); // Clear invalid state
                    // Also try clearing the library's internal storage for this DID
                    try {
                        deleteStoredSession(persistedDid as `did:${string}:${string}`);
                        console.log("Called deleteStoredSession after getSession threw error for DID:", persistedDid);
                    } catch (deleteErr) {
                        console.error("Error calling deleteStoredSession after getSession error:", deleteErr);
                    }
					if (isMounted) atCuteState.value = null;
				}
			} else {
                console.log("No persisted DID found in localStorage.");
				if (isMounted) atCuteState.value = null; // No persisted session
			}

			if (isMounted) isLoadingSession.value = false;
		};

		processLoginOrLoadSession();

		return () => {
			isMounted = false;
		};
	}, []); // Run only on mount

	return { state: atCuteState.value, isLoading: isLoadingSession.value || isProcessingLogin };
};

// --- Actions ---

// Custom error for login abort
class LoginAbortError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LoginAbortError';
	}
}

export const startLoginProcess = async (handleOrDid: string) => {
	if (!handleOrDid) {
		alert("Please enter your Bluesky handle (e.g., yourname.bsky.social)");
		return;
	}
	try {
        console.log(`Resolving identity for: ${handleOrDid}`);
		const { identity, metadata } = await resolveFromIdentity(handleOrDid);
        console.log("Identity resolved:", identity, "Metadata:", metadata);
        
		const authUrl = await createAuthorizationUrl({
			metadata: metadata, // PDS details
			identity: identity, // User's DID
			scope: import.meta.env.VITE_OAUTH_SCOPE, // Use scope from env var
		});
        console.log("Redirecting to auth URL:", authUrl);

        // Wait briefly for storage persistence as recommended
		await sleep(200);

		// Add listener to detect if user navigates back before redirect happens
		let didAbort = false;
		const abortListener = () => {
			didAbort = true;
			console.warn("Login aborted by user (pageshow event).");
			// Optionally: Provide UI feedback that login was cancelled
		};
		window.addEventListener('pageshow', abortListener, { once: true });

		window.location.assign(authUrl);

		// This part of the code should ideally not be reached if the redirect succeeds.
		// If it does, it might be due to the pageshow listener firing or some other interruption.
		// We'll wait a moment and then clean up the listener if we weren't redirected.
		await sleep(500); // Give redirect a moment

		window.removeEventListener('pageshow', abortListener);

		if (didAbort) {
			// Throw a specific error if we detected the abort via pageshow
			throw new LoginAbortError("User aborted the login request.");
		}

		// If we reach here and didn't detect 'pageshow', something else prevented the redirect.
		console.error("Redirect did not occur as expected after login initiation.");
		throw new Error("Failed to redirect for login.");

	} catch (error) {
        // Catch the specific abort error type
		if (error instanceof LoginAbortError) {
			// Handle abort specifically (e.g., show a message) - currently just logs
			console.log(error.message);
			// Optionally re-enable UI elements if they were disabled
			return; // Don't show the generic error alert
		}
		console.error("Login initiation error:", error);
		alert(`Failed to start login process: ${error instanceof Error ? error.message : String(error)}`);
	}
};

export const logout = async () => {
	const currentAgent = atCuteState.value?.agent;
    const did = atCuteState.value?.session.info.sub;

    // Clear local state immediately for responsiveness
    if (did) {
        localStorage.removeItem("atcute-oauth:did");
    }
    atCuteState.value = null;

    // Attempt to sign out using the agent (handles library's internal storage and potential revocation)
    if (currentAgent) {
        try {
            await currentAgent.signOut();
        } catch (error) {
            console.error("Agent signOut failed:", error);
            // As a fallback if signOut fails, ensure the library's storage is cleared
            if (did) {
                try {
                    deleteStoredSession(did);
                } catch (deleteError) {
                    console.error("Fallback deleteStoredSession failed:", deleteError);
                }
            }
        }
    } else if (did) {
        // If there was a DID but no agent (e.g., state cleared before async call completed),
        // still try to clear the library's storage as a best effort.
         try {
            deleteStoredSession(did);
        } catch (deleteError) {
            console.error("deleteStoredSession failed (no agent available):", deleteError);
        }
    }

	// Optionally reload or redirect after logout actions are attempted
	// window.location.reload();
}; 