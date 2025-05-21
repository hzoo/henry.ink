import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { getPostThread } from "@/lib/bsky";
import type { ThreadReply } from "@/lib/types";
import { isRecord } from "@/lib/postActions";

function isThreadViewPost(v: unknown): v is AppBskyFeedDefs.ThreadViewPost {
	return (
		typeof v === "object" &&
		v !== null &&
		"$type" in v &&
		v.$type === "app.bsky.feed.defs#threadViewPost"
	);
}

function processThreadReplies(
	thread: AppBskyFeedDefs.ThreadViewPost,
): ThreadReply[] {
	if (!thread.replies) return [];

	return thread.replies.filter(isThreadViewPost).map((reply) => ({
		post: (reply as AppBskyFeedDefs.ThreadViewPost).post,
		replies: (reply as AppBskyFeedDefs.ThreadViewPost).replies
			? processThreadReplies(reply as AppBskyFeedDefs.ThreadViewPost)
			: undefined,
	}));
}

const DEFAULT_FETCH_DEPTH = 11;

export type Thread = { post: AppBskyFeedDefs.PostView; replies: ThreadReply[] };
/**
 * Fetches a thread, processes its replies for use with react-query.
 * Returns the main post and its processed replies.
 */
export async function fetchProcessedThread(
	uri: string,
	options: { depth?: number } = {},
): Promise<Thread> {
	const { depth = DEFAULT_FETCH_DEPTH } = options;
	const threadView = await getPostThread(uri, { depth });

	if (threadView && isThreadViewPost(threadView)) {
		return {
			post: threadView.post,
			replies: processThreadReplies(threadView),
		};
	}
	// If threadView is not found, or not the expected type, throw an error
	// This allows react-query to handle the error state.
	console.warn(
		`[API] Thread not found or invalid format for URI: ${uri}. Thread data:`,
		threadView,
	);
	throw new Error(`Thread not found or invalid format for URI: ${uri}`);
}

export function getRootPostUri(post: AppBskyFeedDefs.PostView): string {
	if (isRecord(post.record) && post.record.reply?.root?.uri) {
		return post.record.reply.root.uri;
	}
	return post.uri;
}
