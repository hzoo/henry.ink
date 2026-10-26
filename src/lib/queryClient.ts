import { QueryClient } from "@tanstack/react-query";
import { experimental_createQueryPersister, type PersistedQuery } from "@tanstack/react-query-persist-client";
import { openDB, type IDBPDatabase } from 'idb';
import type { AppBskyFeedDefs } from '@atcute/bluesky';
import type { ResourceUri } from '@atcute/lexicons';
import type { Thread } from '@/src/lib/threadUtils';

const DB_NAME = 'bsky-search';
const STORE_NAME = 'queries';
const VERSION = 1;

if (typeof window !== 'undefined') {
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

// Keep successful actions in the same viewer-owned data used after navigation.
export function updatePostActionCache(
	client: QueryClient,
	did: string,
	postUri: string,
	action: 'like' | 'repost',
	uri?: ResourceUri,
) {
	const count = action === 'like' ? 'likeCount' : 'repostCount';
	let changed = false;
	const updatePost = (post: AppBskyFeedDefs.PostView): AppBskyFeedDefs.PostView => {
		if (post.uri !== postUri || post.viewer?.[action] === uri) return post;
		changed = true;
		return {
			...post,
			[count]: Math.max(0, (post[count] ?? 0) + Number(!!uri) - Number(!!post.viewer?.[action])),
			viewer: { ...post.viewer, [action]: uri },
		};
	};
	const updateThread = (thread: Thread): Thread => ({
		...thread,
		post: updatePost(thread.post),
		...(thread.replies && { replies: thread.replies.map(updateThread) }),
	});

	for (const query of client.getQueryCache().findAll({
		predicate: query => query.queryKey[2] === did && ['posts', 'authorFeed', 'thread'].includes(query.queryKey[0] as string),
	})) {
		const previous = query.state.data;
		if (!previous) continue;
		changed = false;
		let next: unknown;
		if (query.queryKey[0] === 'posts') next = (previous as AppBskyFeedDefs.PostView[]).map(updatePost);
		else if (query.queryKey[0] === 'thread') next = updateThread(previous as Thread);
		else {
			const feed = previous as { feed: AppBskyFeedDefs.FeedViewPost[] };
			next = { ...feed, feed: feed.feed.map(item => ({ ...item, post: updatePost(item.post) })) };
		}
		if (changed) {
			client.setQueryData(query.queryKey, next);
			void appPersister.persistQueryByKey(query.queryKey, client);
		}
	}
}
