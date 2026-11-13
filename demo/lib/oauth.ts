import { signal } from "@preact/signals";
import { Client } from "@atcute/client";
import {
	configureOAuth,
	createAuthorizationUrl,
	finalizeAuthorization,
	getSession,
	deleteStoredSession,
	OAuthUserAgent,
	TokenRefreshError,
	resolveFromService,
} from "@atcute/oauth-browser-client";
import { useEffect } from "preact/hooks";
import { oauthCallbackParams } from '@/src/lib/oauth-callback';

const isBrowserExtension =
	typeof browser !== "undefined" && !!browser.runtime?.id;

const selectedDidKey = "atcute-oauth:did";
let isOAuthInitialized = false;
let sessionLifetime = new AbortController();

export function initializeOAuth() {
	if (typeof window !== "undefined" && !isOAuthInitialized) {
		configureOAuth({
			metadata: {
				client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
				redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
			},
		});
		window.addEventListener("storage", event => {
			if (event.storageArea === window.localStorage && (event.key === selectedDidKey || event.key === null)) {
				clearSession();
			}
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

function clearSession() {
	sessionLifetime.abort(new Error("Login required."));
	sessionLifetime = new AbortController();
	atCuteState.value = null;
}

function createState(session: AtCuteSessionData, lifetime: AbortSignal): AtCuteState {
	const agent = new OAuthUserAgent(session);
	const rpc = new Client({
		handler: (pathname, init) => {
			lifetime.throwIfAborted();
			const requestSignal = init?.signal ? AbortSignal.any([init.signal, lifetime]) : lifetime;
			return agent.handle(pathname, { ...init, signal: requestSignal });
		},
	});
	return { agent, rpc, session };
}

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
		sessionStorage.removeItem('atcute-oauth:return-url');
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
	return null;
};

export const useAtCute = () => {
	useEffect(() => {
		let isMounted = true;
		const lifetime = sessionLifetime.signal;

		const loadSession = async () => {
			initializeOAuth();

			const params = oauthCallbackParams(new URL(window.location.href), import.meta.env.VITE_OAUTH_REDIRECT_URI);
			if (params) {
				try {
					history.replaceState(null, "", location.pathname);
					
					const session = await finalizeAuthorization(params);
					if (isMounted && !lifetime.aborted) {
						localStorage.setItem(selectedDidKey, session.info.sub);
						atCuteState.value = createState(session, lifetime);
					}
				} catch (error) {
					console.error("OAuth finalization error:", error);
				}
				if (isMounted && !lifetime.aborted) {
					const returnUrl = getReturnUrl();
					if (returnUrl && returnUrl !== window.location.href) {
						window.location.assign(returnUrl);
						return;
					}
				}
			} else {
				const persistedDid = localStorage.getItem(selectedDidKey);
				if (!persistedDid) return;

				const stillSelected = () => isMounted && !lifetime.aborted &&
					localStorage.getItem(selectedDidKey) === persistedDid;
				try {
					const session = await getSession(
						persistedDid as `did:${string}:${string}`,
						{ allowStale: false, signal: lifetime },
					);
					if (stillSelected()) atCuteState.value = createState(session, lifetime);
				} catch (error) {
					if (error instanceof TokenRefreshError && error.sub === persistedDid && stillSelected()) {
						clearSession();
						localStorage.removeItem(selectedDidKey);
					}
				}
			}
		};

		void loadSession().catch(error => {
			console.error("Session restoration error:", error);
		}).finally(() => {
			if (isMounted) isLoadingSession.value = false;
		});

		return () => {
			isMounted = false;
		};
	}, []);
};

// Start login process - always generic
export const startLoginProcess = async () => {
	const lifetime = sessionLifetime.signal;
	try {
		initializeOAuth();
		
		// Store current URL if not on home page
		if (window.location.pathname !== '/') {
			storeReturnUrl(window.location.href);
		} else {
			sessionStorage.removeItem('atcute-oauth:return-url');
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
			if (lifetime.aborted) return;
			localStorage.setItem(selectedDidKey, session.info.sub);
			atCuteState.value = createState(session, lifetime);
			isLoadingSession.value = false;
			
			// For extensions, also handle return URL if available
			const returnUrl = getReturnUrl();
			if (returnUrl && returnUrl !== window.location.href) {
				window.location.assign(returnUrl);
			}
		} else {
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
	clearSession();
	try {
		localStorage.removeItem(selectedDidKey);
		if (did) {
			localStorage.removeItem(`bskyUserHandle_${did}`);
			localStorage.removeItem(`bskyUserAvatar_${did}`);
		}
	} catch { /* Storage cleanup must not prevent signing out. */ }
	
	// Clean up stored session (optional, for completeness)
	if (did) {
		try {
			deleteStoredSession(did);
		} catch {}
	}
	
	// Skip signOut() - tokens expire in 15 minutes anyway
	// This avoids 400 errors when tokens are already expired/revoked
};
