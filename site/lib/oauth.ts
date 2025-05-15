import { signal } from "@preact/signals";
import { Client } from "@atcute/client";
import {
  configureOAuth,
  createAuthorizationUrl,
  finalizeAuthorization,
  getSession,
  deleteStoredSession,
  OAuthUserAgent,
  resolveFromIdentity,
} from "@atcute/oauth-browser-client";
import { useEffect } from "preact/hooks";
import { sleep } from "@/lib/utils/sleep";

const isBrowserExtension = typeof browser !== 'undefined' && !!browser.runtime?.id;

export function initializeOAuth() {
	if (typeof window !== "undefined") {
		const clientId = import.meta.env.VITE_OAUTH_CLIENT_ID;
		const redirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI;
		console.log(`[initializeOAuth] Configuring with Client ID: ${clientId}`);
		configureOAuth({
			metadata: {
				client_id: clientId,
				redirect_uri: redirectUri,
			},
		});
	}
}

type AtCuteSessionData = Awaited<ReturnType<typeof finalizeAuthorization>>;
export interface AtCuteState {
	agent: OAuthUserAgent;
	rpc: Client;
	session: AtCuteSessionData;
}

export const atCuteState = signal<AtCuteState | null>(null);
export const isLoadingSession = signal(true);

export const useAtCute = () => {
    console.log("RUN ONCE");
	useEffect(() => {
		let isMounted = true;
		isLoadingSession.value = true;

		const processLoginOrLoadSession = async () => {
			initializeOAuth(); // Ensure config is set before getSession/finalize

			// 1. Check if returning from OAuth provider (standard web flow)
            if (!isBrowserExtension && (location.hash.includes("state=") || location.search.includes("code="))) {
                try {
                    console.log("Handling web OAuth callback...");
                    const params = new URLSearchParams(location.hash ? location.hash.slice(1) : location.search);
                    history.replaceState(null, "", location.pathname); // Clean URL
                    const session = await finalizeAuthorization(params);
                    const agent = new OAuthUserAgent(session);
                    const rpc = new Client({ handler: agent });
                    if (isMounted) {
                        atCuteState.value = { agent, rpc, session };
                        localStorage.setItem("atcute-oauth:did", session.info.sub);
                        console.log("Web OAuth successful, session established.");
                    }
                } catch (error) {
                    console.error("OAuth finalization error (Web Flow):", error);
                    localStorage.removeItem("atcute-oauth:did");
                    if (isMounted) atCuteState.value = null;
                } finally {
                     if (isMounted) {
                        isLoadingSession.value = false;
                     }
                }
                return;
            }

			// 2. Check for existing persisted session (common logic)
			const persistedDid = localStorage.getItem("atcute-oauth:did");
			if (persistedDid) {
				try {
                    console.log(`Attempting to load session for persisted DID: ${persistedDid}`);
					const session = await getSession(persistedDid as `did:${string}:${string}`, {
						allowStale: false,
					 });
					if (session && isMounted) {
                        console.log("Successfully loaded/refreshed session:", session.info.sub); // Log only sub for brevity
						const agent = new OAuthUserAgent(session);
						const rpc = new Client({ handler: agent });
						atCuteState.value = { agent, rpc, session };
					} else if (!session) {
                        console.warn("getSession returned null (likely refresh failure), clearing potentially invalid session for DID:", persistedDid);
						localStorage.removeItem("atcute-oauth:did");
                        try {
                            deleteStoredSession(persistedDid as `did:${string}:${string}`);
                            console.log("Called deleteStoredSession for potentially invalid DID:", persistedDid);
                        } catch (deleteErr) {
                            console.error("Error calling deleteStoredSession:", deleteErr);
                        }
						if (isMounted) atCuteState.value = null;
					}
				} catch (error) {
					// Don't log full error if it's just 'no session found' or similar benign cases
                    if (!(error instanceof Error && error.message.toLowerCase().includes("no session found"))) {
                        console.error(`Error during getSession for DID ${persistedDid}:`, error);
                    } else {
                         console.log(`No valid session found via getSession for DID ${persistedDid}.`);
                    }
					localStorage.removeItem("atcute-oauth:did");
                    try {
                        // Still try to delete in case of error
                        deleteStoredSession(persistedDid as `did:${string}:${string}`);
                         console.log("Called deleteStoredSession after getSession check for DID:", persistedDid);
                    } catch (deleteErr) {
                        // Ignore error if delete fails here, already logged primary error
                    }
					if (isMounted) atCuteState.value = null;
				}
			} else {
                // This is normal, no need to log usually unless debugging first load
                // console.log("No persisted DID found in localStorage.");
				if (isMounted) atCuteState.value = null; // No persisted session
			}

			if (isMounted) isLoadingSession.value = false;
		};

		processLoginOrLoadSession();

		return () => {
			isMounted = false;
		};
	}, []);
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
        console.log(`Starting login process for: ${handleOrDid}`);
		const { identity, metadata } = await resolveFromIdentity(handleOrDid);
        // Removed detailed metadata log
        console.log("Resolved Identity (DID):", identity);

		const authUrl = await createAuthorizationUrl({
			metadata: metadata,
			identity: identity,
			scope: import.meta.env.VITE_OAUTH_SCOPE,
		});

        if (isBrowserExtension) {
            console.log("Launching web auth flow for extension...");
            const finalRedirectUrl = await browser.identity.launchWebAuthFlow({
                url: authUrl.toString(),
                interactive: true,
            });
            // Keep this log, useful for debugging the final intercept
            console.log("launchWebAuthFlow successful, final callback URL:", finalRedirectUrl);

            if (!finalRedirectUrl) {
                if (browser.runtime.lastError?.message?.includes('user closed')) {
                    throw new LoginAbortError("Login cancelled by user.");
                }
                throw new Error("Authentication flow did not return a callback URL.");
            }

            console.log("Finalizing authorization with callback URL...");
            const callbackUrlObj = new URL(finalRedirectUrl);
            const params = new URLSearchParams(callbackUrlObj.search || callbackUrlObj.hash.slice(1));

            const session = await finalizeAuthorization(params);
            const agent = new OAuthUserAgent(session);
            const rpc = new Client({ handler: agent });
            atCuteState.value = { agent, rpc, session };
            localStorage.setItem("atcute-oauth:did", session.info.sub);
            console.log("Extension login successful, session established.");
            if (isLoadingSession.peek()) isLoadingSession.value = false; // Ensure loading state is false

        } else {
            // Standard web flow
            console.log("Redirecting for standard web flow...");
            await sleep(200);
            window.location.assign(authUrl.toString());
        }

	} catch (error) {
        if (error instanceof LoginAbortError) {
             console.log(error.message); // Just log cancellation
             if (isLoadingSession.peek()) isLoadingSession.value = false;
             return;
        }
		console.error("Login initiation or finalization error:", error);
        const errorMsg = error instanceof Error ? error.message.toLowerCase() : "";
        // Don't alert for cancellations
        if (!(errorMsg.includes("cancelled") || errorMsg.includes("user closed")))
        {
            alert(`Failed to complete login process: ${error instanceof Error ? error.message : String(error)}`);
        } else {
             console.log("Login process cancelled or popup closed.");
        }
        if (isLoadingSession.peek()) isLoadingSession.value = false;
	}
};


export const logout = async () => {
	const currentAgent = atCuteState.value?.agent;
    const did = atCuteState.value?.session.info.sub;
     console.log(`Starting logout process for DID: ${did || 'N/A'}`);

    if (did) {
        localStorage.removeItem("atcute-oauth:did");
    }
    atCuteState.value = null; // Update UI immediately

    if (currentAgent) {
        try {
            await currentAgent.signOut();
             console.log("Agent signOut successful.");
        } catch (error) {
            console.error("Agent signOut failed:", error);
            if (did) {
                try {
                    deleteStoredSession(did);
                     console.log("Fallback deleteStoredSession successful after signOut error.");
                } catch (deleteError) {
                    console.error("Fallback deleteStoredSession failed:", deleteError);
                }
            }
        }
    } else if (did) {
         try {
            deleteStoredSession(did);
             console.log("deleteStoredSession successful (no agent available).");
        } catch (deleteError) {
            console.error("deleteStoredSession failed (no agent available):", deleteError);
        }
    }
     console.log("Logout process complete.");
};