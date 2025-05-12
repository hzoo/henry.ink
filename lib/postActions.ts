import type { AtCuteState } from "@/site/lib/oauth";
import type {
	AppBskyFeedDefs,
	ComAtprotoRepoCreateRecord,
	AppBskyFeedPost,
	ComAtprotoRepoDeleteRecord,
} from "@atcute/client/lexicons";

export function isRecord(record: unknown): record is AppBskyFeedPost.Record {
	return (
		typeof record === "object" &&
		record !== null &&
		"$type" in record &&
		record.$type === "app.bsky.feed.post"
	);
}

/**
 * Submits a reply to a given post.
 * Throws an error if submission fails.
 */
export async function submitReply(
	post: AppBskyFeedDefs.PostView,
	text: string,
	state: AtCuteState, // Pass the entire state for convenience
) {
	if (!state?.agent || !state?.session) {
		throw new Error("User is not logged in.");
	}
	if (!state.rpc) {
		throw new Error("RPC client is not available.");
	}

	const { session, rpc } = state;

	const parentRef = { uri: post.uri, cid: post.cid };
	const replyRecord: AppBskyFeedPost.Record = {
		$type: "app.bsky.feed.post",
		text: text,
		reply: {
			root: (post.record as AppBskyFeedPost.Record).reply?.root || parentRef,
			parent: parentRef,
		},
		createdAt: new Date().toISOString(),
	};

	const createRecordInput: ComAtprotoRepoCreateRecord.Input = {
		repo: session.info.sub,
		collection: "app.bsky.feed.post",
		record: replyRecord as ComAtprotoRepoCreateRecord.Input["record"],
	};

	// Use the rpc instance from the global state with the 2-argument pattern
	return rpc.post(
		"com.atproto.repo.createRecord", // nsid
		{ input: createRecordInput },
	);
}

/**
 * Likes a given post.
 * Returns the URI of the like record.
 * Throws an error if liking fails.
 */
export async function likePost(
	post: AppBskyFeedDefs.PostView,
	state: AtCuteState,
) {
	if (!state?.agent || !state?.session) {
		throw new Error("User is not logged in.");
	}
	if (!state.rpc) {
		throw new Error("RPC client is not available.");
	}
	const { session, rpc } = state;

	const likeRecord = {
		$type: "app.bsky.feed.like",
		subject: {
			uri: post.uri,
			cid: post.cid,
		},
		createdAt: new Date().toISOString(),
	};

	const createRecordInput: ComAtprotoRepoCreateRecord.Input = {
		repo: session.info.sub,
		collection: "app.bsky.feed.like",
		record: likeRecord as ComAtprotoRepoCreateRecord.Input["record"],
	};

	const {ok, data} = await rpc.post("com.atproto.repo.createRecord", {
		input: createRecordInput,
	});

	if (!ok) {	
		throw new Error(`Error liking post: ${data.error}`);
	}

	// Return the URI of the created like record, useful for unliking
	return data.uri;
}

/**
 * Unlikes a given post.
 * Requires the URI of the like record to delete.
 * Throws an error if unliking fails.
 */
export async function unlikePost(likeUri: string, state: AtCuteState) {
	if (!state?.agent || !state?.session) {
		throw new Error("User is not logged in.");
	}
	if (!state.rpc) {
		throw new Error("RPC client is not available.");
	}
	const { session, rpc } = state;

	if (!likeUri) {
		throw new Error("Like URI is required to unlike a post.");
	}

	// Extract rkey from the like URI (e.g., at://did:plc:xyz/app.bsky.feed.like/3kxyzabc)
	const rkey = likeUri.split("/").pop();
	if (!rkey) {
		throw new Error("Could not extract rkey from like URI.");
	}

	const deleteRecordInput: ComAtprotoRepoDeleteRecord.Input = {
		repo: session.info.sub,
		collection: "app.bsky.feed.like",
		rkey: rkey,
	};

	return rpc.post("com.atproto.repo.deleteRecord", {
		input: deleteRecordInput,
	});
}

/**
 * Reposts a given post.
 * Returns the URI of the repost record.
 * Throws an error if reposting fails.
 */
export async function repostPost(
	post: AppBskyFeedDefs.PostView,
	state: AtCuteState,
) {
	if (!state?.agent || !state?.session) {
		throw new Error("User is not logged in.");
	}
	if (!state.rpc) {
		throw new Error("RPC client is not available.");
	}
	const { session, rpc } = state;

	const repostRecord = {
		$type: "app.bsky.feed.repost",
		subject: {
			uri: post.uri,
			cid: post.cid,
		},
		createdAt: new Date().toISOString(),
	};

	const createRecordInput: ComAtprotoRepoCreateRecord.Input = {
		repo: session.info.sub,
		collection: "app.bsky.feed.repost",
		record: repostRecord as ComAtprotoRepoCreateRecord.Input["record"],
	};

	const {ok, data} = await rpc.post("com.atproto.repo.createRecord", {
		input: createRecordInput,
	});

	if (!ok) {
		throw new Error(`Error reposting post: ${data.error}`);
	}

	// Return the URI of the created repost record, useful for deleting the repost
	return data.uri;
}

/**
 * Deletes a repost.
 * Requires the URI of the repost record to delete.
 * Throws an error if deleting fails.
 */
export async function deleteRepost(repostUri: string, state: AtCuteState) {
	if (!state?.agent || !state?.session) {
		throw new Error("User is not logged in.");
	}
	if (!state.rpc) {
		throw new Error("RPC client is not available.");
	}
	const { session, rpc } = state;

	if (!repostUri) {
		throw new Error("Repost URI is required to delete a repost.");
	}

	const rkey = repostUri.split("/").pop();
	if (!rkey) {
		throw new Error("Could not extract rkey from repost URI.");
	}

	const deleteRecordInput: ComAtprotoRepoDeleteRecord.Input = {
		repo: session.info.sub,
		collection: "app.bsky.feed.repost",
		rkey: rkey,
	};

	return rpc.post("com.atproto.repo.deleteRecord", {
		input: deleteRecordInput,
	});
}
