import { QueryClient } from "@tanstack/react-query";
import { experimental_createQueryPersister } from "@tanstack/react-query-persist-client";
import type { AsyncStorage } from "@tanstack/query-persist-client-core";

// Helper to estimate localStorage usage for our cache
function estimateStorageSize(): number {
	try {
		let totalSize = 0;
		for (const key in localStorage) {
			if (key.startsWith("bsky-search-experimental")) {
				totalSize += localStorage[key].length + key.length;
			}
		}
		return totalSize;
	} catch {
		return 0;
	}
}

// Helper to check if we're approaching localStorage quota
function isApproachingQuota(): boolean {
	const totalSize = estimateStorageSize();
	// Most browsers have 5-10MB limit, be conservative and trigger at 3MB
	return totalSize > 3 * 1024 * 1024;
}

// Helper to clear old cache entries based on dataUpdatedAt timestamps
function clearOldCacheEntries(): void {
	try {
		const keys = Object.keys(localStorage);
		const cacheKeys = keys.filter((k) => k.startsWith("bsky-search-experimental"));
		
		if (cacheKeys.length === 0) return;

		// Parse entries to get timestamps
		const entriesWithTimestamp: Array<{ key: string; timestamp: number }> = [];
		
		for (const key of cacheKeys) {
			try {
				const value = localStorage.getItem(key);
				if (value) {
					const parsed = JSON.parse(value);
					const timestamp = parsed.state?.dataUpdatedAt || 0;
					entriesWithTimestamp.push({ key, timestamp });
				}
			} catch {
				// If we can't parse, assume it's old and should be removed
				entriesWithTimestamp.push({ key, timestamp: 0 });
			}
		}

		// Sort by timestamp (oldest first)
		entriesWithTimestamp.sort((a, b) => a.timestamp - b.timestamp);

		// Remove oldest 40% of entries
		const toRemove = Math.ceil(entriesWithTimestamp.length * 0.4);
		const keysToRemove = entriesWithTimestamp.slice(0, toRemove);

		console.log(`Proactively clearing ${keysToRemove.length} old cache entries to prevent quota issues`);
		
		for (const { key } of keysToRemove) {
			localStorage.removeItem(key);
		}
	} catch (error) {
		console.warn("Failed to clear old cache entries:", error);
	}
}

const localStorageWrapper: AsyncStorage = {
	getItem: async (key: string) => {
		return Promise.resolve(window.localStorage.getItem(key));
	},
	setItem: async (key: string, value: string) => {
		// Proactive cache management - check quota before writing
		if (isApproachingQuota()) {
			clearOldCacheEntries();
		}

		try {
			window.localStorage.setItem(key, value);
		} catch (error) {
			if (error instanceof DOMException && (error.code === 22 || error.name === 'QuotaExceededError')) {
				// QuotaExceededError - clear thread and arena cache and retry
				console.warn("LocalStorage quota exceeded, clearing cache");
				try {
					const keys = Object.keys(localStorage);
					const cacheKeys = keys.filter((k) =>
						k.startsWith("bsky-search-experimental")
					);
					console.log(`Clearing ${cacheKeys.length} cache entries (all query cache)`);
					cacheKeys.forEach((k) => localStorage.removeItem(k));
					// Try again after clearing
					window.localStorage.setItem(key, value);
				} catch (retryError) {
					console.warn(
						"Failed to write after clearing cache:",
						retryError,
					);
					// Don't throw, just silently fail to cache
					return Promise.resolve();
				}
			} else {
				// For other errors, log but don't throw to prevent unhandled rejections
				console.error("Failed to cache query data:", error);
				return Promise.resolve();
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
