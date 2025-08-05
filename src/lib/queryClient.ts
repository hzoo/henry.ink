import { QueryClient } from "@tanstack/react-query";
import { experimental_createQueryPersister, type PersistedQuery } from "@tanstack/react-query-persist-client";
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'bsky-search';
const STORE_NAME = 'queries';
const VERSION = 1;

if (typeof window !== 'undefined' && window.localStorage) {
	try {
		const keys = Object.keys(localStorage);
		const oldCacheKeys = keys.filter(k => k.startsWith('bsky-search-experimental'));
		if (oldCacheKeys.length > 0) {
			console.log(`Migrating from localStorage: clearing ${oldCacheKeys.length} old cache entries`);
			oldCacheKeys.forEach(k => localStorage.removeItem(k));
		}
	} catch (err) {
		console.warn('Failed to clear old localStorage cache:', err);
	}
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
	if (dbPromise) return dbPromise;

	dbPromise = openDB(DB_NAME, VERSION, {
		upgrade(db) {
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		},
		blocked() {
			console.warn('[IDB] open blocked: another connection is holding the DB');
		},
		blocking() {
			console.warn('[IDB] blocking a future version');
		},
		terminated() {
			console.warn('[IDB] connection terminated');
			dbPromise = null;
		},
	});

	return dbPromise;
}

const storage = {
	async getItem(key: string): Promise<PersistedQuery | undefined> {
		try {
			const db = await getDb();
			return db.get(STORE_NAME, key);
		} catch (err) {
			console.warn('[IDB] getItem failed:', err);
			return undefined;
		}
	},

	async setItem(key: string, value: PersistedQuery): Promise<void> {
		try {
			const db = await getDb();
			await db.put(STORE_NAME, value, key);
		} catch (err) {
			console.warn('[IDB] setItem failed:', err);
		}
	},

	async removeItem(key: string): Promise<void> {
		try {
			const db = await getDb();
			await db.delete(STORE_NAME, key);
		} catch (err) {
			console.warn('[IDB] removeItem failed:', err);
		}
	},
};

export const appPersister = experimental_createQueryPersister<PersistedQuery>({
	storage,
	prefix: "bsky-search",
	maxAge: 1000 * 60 * 60 * 24 * 7,
	serialize: d => d,
	deserialize: d => d,
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
