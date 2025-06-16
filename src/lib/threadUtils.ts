import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { getPostThread } from "@/src/lib/bsky";
import { isRecord } from "@/src/lib/postActions";

const DEFAULT_FETCH_DEPTH = 11;

export type Thread = {
	post: AppBskyFeedDefs.PostView;
	replies?: Thread[];
};

export function isThreadViewPost(
	v: unknown,
): v is AppBskyFeedDefs.ThreadViewPost {
	return (
		typeof v === "object" &&
		v !== null &&
		"$type" in v &&
		v.$type === "app.bsky.feed.defs#threadViewPost"
	);
}

export function processThreadReplies(thread: Thread): Thread[] {
	if (!thread.replies) {
		return [];
	}

	return thread.replies.filter(isThreadViewPost).map((reply) => {
		const processedReply: Thread = {
			post: reply.post,
		};
		if (reply.replies?.length) {
			processedReply.replies = processThreadReplies(reply);
		}
		return processedReply;
	});
}

export async function fetchProcessedThread(uri: string): Promise<Thread> {
	const thread = (await getPostThread(uri, {
		depth: DEFAULT_FETCH_DEPTH,
	})) as Thread;
	return {
		post: thread.post,
		replies: processThreadReplies(thread),
	};
}

export function getRootPostUri(post: AppBskyFeedDefs.PostView): string {
	if (isRecord(post.record) && post.record.reply?.root?.uri) {
		return post.record.reply.root.uri;
	}
	return post.uri;
}
