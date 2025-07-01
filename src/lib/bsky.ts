import { atCuteState } from "@/demo/lib/oauth";
import { Client, simpleFetchHandler } from "@atcute/client";
import type { AppBskyFeedSearchPosts } from "@atcute/bluesky";
import type {
	ActorIdentifier,
	InferOutput,
	ResourceUri,
} from "@atcute/lexicons";

const rpc = new Client({
	handler: simpleFetchHandler({ service: "https://public.api.bsky.app" }),
});

// Calculate engagement score for a post
function getEngagementScore(post: {
	likeCount?: number;
	repostCount?: number;
	replyCount?: number;
}) {
	const likes = post.likeCount || 0;
	const reposts = post.repostCount || 0;
	const replies = post.replyCount || 0;
	// You could weight these differently if desired, e.g.:
	// return (likes * 1) + (reposts * 2) + (replies * 1.5);
	return likes + reposts + replies;
}

function sortPosts(
	posts: InferOutput<
		AppBskyFeedSearchPosts.mainSchema["output"]["schema"]
	>["posts"],
) {
	return posts.sort((a, b) => {
		const scoreA = getEngagementScore(a);
		const scoreB = getEngagementScore(b);
		return scoreB - scoreA;
	});
}

export async function searchBskyPosts(
	url: string,
	options?: { signal?: AbortSignal },
) {
	try {
		const params = {
			q: "*",
			url: url as `https://${string}`,
			sort: "top",
			limit: 100,
		};

		if (!atCuteState.value?.rpc) {
			// Use the worker for search, it handles caching and auth forwarding
			const workerUrl = `${import.meta.env.VITE_WORKER_URL}?url=${encodeURIComponent(url)}`;
			const res = await fetch(workerUrl, {
				method: "GET",
				signal: options?.signal,
			});

			if (!res.ok) {
				// Attempt to parse JSON error response if available
				let errorDetail = res.statusText;
				try {
					errorDetail = await res.text();
				} catch (e) {
					console.error("Failed to parse error response body:", e);
				}

				let errorMessage = `Error searching Bluesky posts: ${res.status} ${errorDetail}`;

				// Special handling for authentication required errors from the worker
				if (res.status === 401) {
					errorMessage =
						"Bluesky search sometimes requires login due to high load. See:";
				}

				throw new Error(errorMessage);
			}

			const data = (await res.json()) as InferOutput<
				AppBskyFeedSearchPosts.mainSchema["output"]["schema"]
			>;
			return sortPosts(data.posts);
		}

		// Direct RPC call if rpc is available (user is logged in)
		const { ok, data } = await atCuteState.value.rpc.get(
			"app.bsky.feed.searchPosts",
			{ params, signal: options?.signal },
		);

		if (!ok) {
			switch (data.error) {
				case "AuthMissing":
					throw new Error(
						"Bluesky search sometimes requires login due to high load. See:",
					);
				default:
					throw new Error(`Error searching Bluesky posts: ${data.error}`);
			}
		}

		return sortPosts(data.posts);
	} catch (error: unknown) {
		console.error("Caught bsky search error:", JSON.stringify(error, null, 2));

		if (error instanceof Error) {
			// Handle network errors or specific messages
			if (error.name !== "AbortError") {
				// Check for authentication required messages from either source
				if (
					error.message.includes("AuthMissing") ||
					error.message.includes("Authentication Required") ||
					error.message.includes("403") ||
					error.message.includes("Authentication failed")
				) {
					console.error("Authentication required:", error);
					throw new Error(
						"Bluesky search sometimes requires login due to high load. See:",
					);
				}
				console.error("Error searching Bluesky posts:", error);
				throw error;
			}
			// AbortError is expected on signal abort, no need to re-throw after logging
		} else {
			// Re-throw non-Error exceptions after logging
			throw error;
		}
	}
}

// window.getRecord = getRecord;
// getRecord('henryzoo.com', 'app.bsky.feed.post', '3lltzjrnjnc2b')
// .reply.root.uri
export async function getRecord(
	repo: string,
	collection: string,
	rkey: string,
	options?: { signal?: AbortSignal },
) {
	try {
		const { ok, data } = await (atCuteState.value?.rpc ?? rpc).get(
			"com.atproto.repo.getRecord",
			{
				params: {
					repo: repo as ActorIdentifier,
					collection: collection as `com.atproto.repo.${string}`,
					rkey,
				},
				signal: options?.signal,
			},
		);

		if (!ok) {
			throw new Error(`Error fetching record: ${data.error}`);
		}

		return data.value;
	} catch (error: unknown) {
		if (error instanceof Error && error.name !== "AbortError") {
			console.error("Error fetching record:", error);
			throw error;
		}
	}
}

export async function getPostThread(
	uri: string,
	options?: { depth?: number; parentHeight?: number; signal?: AbortSignal },
) {
	try {
		const { ok, data } = await (atCuteState.value?.rpc ?? rpc).get(
			"app.bsky.feed.getPostThread",
			{
				params: {
					uri: uri as ResourceUri,
					depth: options?.depth,
					parentHeight: options?.parentHeight,
				},
				signal: options?.signal,
			},
		);

		if (!ok) {
			throw new Error(`Error fetching thread: ${data.error}`);
		}

		return data.thread;
	} catch (error: unknown) {
		if (error instanceof Error && error.name !== "AbortError") {
			console.error("Error fetching thread:", error);
			throw error;
		}
	}
}

export async function getProfile(
	actor: string,
	options?: { signal?: AbortSignal },
) {
	try {
		const { ok, data } = await (atCuteState.value?.rpc ?? rpc).get(
			"app.bsky.actor.getProfile",
			{
				params: {
					actor: actor as ActorIdentifier,
				},
				signal: options?.signal,
			},
		);

		if (!ok) {
			throw new Error(`Error fetching profile: ${data.error}`);
		}

		return data;
	} catch (error: unknown) {
		if (error instanceof Error && error.name !== "AbortError") {
			console.error("Error fetching profile:", error);
			throw error;
		}
	}
}

export async function getAuthorFeed(
	actor: string,
	options?: { limit?: number; cursor?: string; signal?: AbortSignal },
) {
	try {
		const { ok, data } = await (atCuteState.value?.rpc ?? rpc).get(
			"app.bsky.feed.getAuthorFeed",
			{
				params: {
					actor: actor as ActorIdentifier,
					limit: options?.limit || 50,
					cursor: options?.cursor,
				},
				signal: options?.signal,
			},
		);

		if (!ok) {
			throw new Error(`Error fetching author feed: ${data.error}`);
		}

		return data;
	} catch (error: unknown) {
		if (error instanceof Error && error.name !== "AbortError") {
			console.error("Error fetching author feed:", error);
			throw error;
		}
	}
}
