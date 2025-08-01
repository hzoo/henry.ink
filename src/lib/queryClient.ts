import { QueryClient } from "@tanstack/react-query";
import { experimental_createQueryPersister } from "@tanstack/react-query-persist-client";
import type { AsyncStorage } from "@tanstack/query-persist-client-core";

const localStorageWrapper: AsyncStorage = {
	getItem: async (key: string) => {
		return Promise.resolve(window.localStorage.getItem(key));
	},
	setItem: async (key: string, value: string) => {
		try {
			window.localStorage.setItem(key, value);
		} catch (error) {
			if (error instanceof DOMException && error.code === 22) {
				// QuotaExceededError - clear thread and arena cache and retry
				console.warn("LocalStorage quota exceeded, clearing cache");
				try {
					const keys = Object.keys(localStorage);
					const cacheKeys = keys.filter(
						(k) =>
							k.startsWith("bsky-search-experimental") &&
							(k.includes('["thread",') || k.includes('["arenaMatches",'))
					);
					console.log(`Clearing ${cacheKeys.length} cache entries (threads and arena matches)`);
					cacheKeys.forEach((k) => localStorage.removeItem(k));
					// Try again after clearing
					window.localStorage.setItem(key, value);
				} catch (retryError) {
					console.warn(
						"Failed to write after clearing cache:",
						retryError,
					);
				}
			} else {
				throw error;
			}
		}
		return Promise.resolve();
	},
	removeItem: async (key: string) => {
		window.localStorage.removeItem(key);
		return Promise.resolve();
	},
	entries: async () => {
		return Promise.resolve(Object.entries(window.localStorage));
	},
};

export const appPersister = experimental_createQueryPersister({
	storage: localStorageWrapper,
	prefix: "bsky-search-experimental",
	maxAge: 1000 * 60 * 60 * 24 * 7,
});

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 0,
			gcTime: 1000 * 60 * 60 * 24 * 7,
			staleTime: Number.POSITIVE_INFINITY,
			persister: appPersister.persisterFn,
		},
	},
});
