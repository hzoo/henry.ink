import { signal } from "@preact/signals";
import { Client } from "@atcute/client";
import {
	configureOAuth,
	createAuthorizationUrl,
	finalizeAuthorization,
	getSession,
	deleteStoredSession,
	OAuthUserAgent,
	resolveFromService,
} from "@atcute/oauth-browser-client";
import { useEffect } from "preact/hooks";
import { sleep } from "@/src/lib/utils/sleep";

const isBrowserExtension =
	typeof browser !== "undefined" && !!browser.runtime?.id;

let isOAuthInitialized = false;

export function initializeOAuth() {
	if (typeof window !== "undefined" && !isOAuthInitialized) {
		configureOAuth({
			metadata: {
				client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
				redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
			},
		});
		isOAuthInitialized = true;
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

// Helper functions for secure return URL handling
const storeReturnUrl = (url: string) => {
	try {
		const currentOrigin = window.location.origin;
		const urlObj = new URL(url);
		
		// Only store same-origin URLs
		if (urlObj.origin === currentOrigin) {
			sessionStorage.setItem('atcute-oauth:return-url', url);
		}
	} catch {
		// Invalid URL, don't store
	}
};

const getReturnUrl = (): string | null => {
	try {
		const returnUrl = sessionStorage.getItem('atcute-oauth:return-url');
		if (!returnUrl) return null;
		
		const currentOrigin = window.location.origin;
		const urlObj = new URL(returnUrl);
		
		// Only return same-origin URLs
		if (urlObj.origin === currentOrigin) {
			return returnUrl;
		}
	} catch {
		// Invalid URL
	}
	sessionStorage.removeItem('atcute-oauth:return-url'); // Clean up invalid URLs
	return null;
};

export const useAtCute = () => {
	useEffect(() => {
		let isMounted = true;

		const loadSession = async () => {
			initializeOAuth();

			// Check if returning from OAuth callback
			if (location.hash.includes("state=") || location.search.includes("code=")) {
				try {
					const params = new URLSearchParams(
						location.hash ? location.hash.slice(1) : location.search
					);
					history.replaceState(null, "", location.pathname);
					
					const session = await finalizeAuthorization(params);
					const agent = new OAuthUserAgent(session);
					const rpc = new Client({ handler: agent });
					
					if (isMounted) {
						atCuteState.value = { agent, rpc, session };
						localStorage.setItem("atcute-oauth:did", session.info.sub);
						
						// Redirect back to original URL
						const returnUrl = getReturnUrl();
						if (returnUrl && returnUrl !== window.location.href) {
							window.location.assign(returnUrl);
							return;
						}
					}
				} catch (error) {
					console.error("OAuth finalization error:", error);
					localStorage.removeItem("atcute-oauth:did");
				}
			} else {
				// Try to load existing session
				const persistedDid = localStorage.getItem("atcute-oauth:did");
				if (persistedDid) {
					try {
						const session = await getSession(
							persistedDid as `did:${string}:${string}`,
							{ allowStale: false }
						);
						
						if (session && isMounted) {
							const agent = new OAuthUserAgent(session);
							const rpc = new Client({ handler: agent });
							atCuteState.value = { agent, rpc, session };
						} else {
							localStorage.removeItem("atcute-oauth:did");
						}
					} catch (error) {
						localStorage.removeItem("atcute-oauth:did");
					}
				}
			}

			if (isMounted) {
				isLoadingSession.value = false;
			}
		};

		loadSession();

		return () => {
			isMounted = false;
		};
	}, []);
};

// Start login process - always generic
export const startLoginProcess = async () => {
	try {
		initializeOAuth();
		
		// Store current URL if not on home page
		if (window.location.pathname !== '/') {
			storeReturnUrl(window.location.href);
		}
		
		const { metadata } = await resolveFromService('https://bsky.social');
		const authUrl = await createAuthorizationUrl({
			metadata: metadata,
			scope: import.meta.env.VITE_OAUTH_SCOPE,
		});

		if (isBrowserExtension) {
			const finalRedirectUrl = await browser.identity.launchWebAuthFlow({
				url: authUrl.toString(),
				interactive: true,
			});

			if (!finalRedirectUrl) {
				return; // User cancelled
			}

			const callbackUrlObj = new URL(finalRedirectUrl);
			const params = new URLSearchParams(
				callbackUrlObj.search || callbackUrlObj.hash.slice(1)
			);

			const session = await finalizeAuthorization(params);
			const agent = new OAuthUserAgent(session);
			const rpc = new Client({ handler: agent });
			
			atCuteState.value = { agent, rpc, session };
			localStorage.setItem("atcute-oauth:did", session.info.sub);
			isLoadingSession.value = false;
			
			// For extensions, also handle return URL if available
			const returnUrl = getReturnUrl();
			if (returnUrl && returnUrl !== window.location.href) {
				window.location.assign(returnUrl);
			}
		} else {
			await sleep(200);
			window.location.assign(authUrl.toString());
		}
	} catch (error) {
		console.error("Login error:", error);
		alert(`Failed to login: ${error instanceof Error ? error.message : String(error)}`);
	}
};

// Simple logout
export const logout = async () => {
	const did = atCuteState.value?.session.info.sub;
	
	// Immediate logout
	localStorage.removeItem("atcute-oauth:did");
	atCuteState.value = null;
	
	// Clean up stored session (optional, for completeness)
	if (did) {
		try {
			deleteStoredSession(did);
		} catch {}
	}
	
	// Skip signOut() - tokens expire in 15 minutes anyway
	// This avoids 400 errors when tokens are already expired/revoked
};