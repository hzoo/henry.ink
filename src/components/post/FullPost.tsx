import { useSignal } from "@preact/signals-react/runtime";
import { useQuery } from "@tanstack/react-query";

import { PostReplies } from "@/src/components/post/PostReplies";
import { CompactPostActions } from "@/src/components/post/CompactPostActions";
import { Icon } from "@/src/components/Icon";
import { PostEmbed } from "@/src/components/post/PostEmbed";
import { PostText } from "@/src/components/post/PostText";
import { QuoteIndicator } from "@/src/components/highlights/QuoteIndicator";

import {
	getAuthorUrl,
	getPost,
	getAtUriFromUrl,
	getPostId,
} from "@/src/lib/utils/postUrls";
import { getTimeAgo } from "@/src/lib/utils/time";
import { fetchProcessedThread, type Thread } from "@/src/lib/threadUtils";
import { isRecord } from "@/src/lib/postActions";
import type { PostFilter } from "@/src/lib/postFilters";
import { applyFilters } from "@/src/lib/postFilters";
import type { Signal } from "@preact/signals-react";
import { hasShownError } from "@/src/lib/signals";
import type { AppBskyFeedDefs } from '@atcute/bluesky';
import { atCuteState } from "@/demo/lib/oauth";

export type DisplayableItem = "avatar" | "displayName" | "handle";

interface FullPostProps {
	uri?: string;
	postUri?: string;
	filters?: PostFilter[];
	displayItems: DisplayableItem[];
	initialPost?: AppBskyFeedDefs.PostView;
}

function CollapsePost({
	isExpanded,
}: {
	isExpanded: Signal<boolean>;
}) {
	return (
		<button
			type="button"
			aria-label={isExpanded.value ? 'Hide replies' : 'Load replies'}
			aria-expanded={isExpanded.value}
			className="inline-flex min-h-10 items-center gap-1 rounded px-2 text-xs hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-gray-500 dark:hover:bg-gray-800"
			onClick={() => (isExpanded.value = !isExpanded.value)}
		>
			{isExpanded.value ? (
				<Icon name="minusCircle" className="size-4" />
			) : (
				<Icon name="plusCircle" className="size-4" />
			)}
			Replies
		</button>
	);
}

export function FullPost({
	postUri: initialPostUri,
	uri,
	filters,
	displayItems,
	initialPost,
}: FullPostProps) {
	let finalPostUri: string | undefined;
	if (initialPostUri) {
		finalPostUri = initialPostUri;
	} else if (uri) {
		finalPostUri = getAtUriFromUrl(uri);
	}

	if (!displayItems) {
		displayItems = ["avatar", "displayName", "handle"];
	}

	if (!finalPostUri) {
		return (
			<div className="p-4 text-center text-red-500">
				Error: No valid post identifier provided.
			</div>
		);
	}

	const isExpanded = useSignal(!initialPost);
	const state = atCuteState.value;
	const rpc = state?.rpc ?? null;
	const {
		data: threadData,
		isLoading,
		isFetching,
		refetch,
		error,
	} = useQuery<Thread, Error>({
		queryKey: ["thread", finalPostUri, state?.session.info.sub ?? null],
		queryFn: ({ signal }) => {
			return fetchProcessedThread(finalPostUri!, signal, rpc);
		},
		staleTime: 1000 * 60,
		enabled: !initialPost || isExpanded.value,
	});

	const post = threadData?.post || initialPost;
	const replies = threadData?.replies;

	if (isLoading && !initialPost) {
		return null;
	}

	if (error && !initialPost) {
		if (!hasShownError.value) {
			hasShownError.value = true;
		} else {
			return null;
		}

		const errorMessage =
			error instanceof Error ? error.message : "An unknown error occurred";
		return (
			<div className="p-4 text-center text-red-500 dark:text-red-400 flex flex-col items-center">
				<span>Error loading post: {errorMessage}</span>
				<span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
					({errorMessage})
				</span>
			</div>
		);
	}

	if (!post) {
		// This can happen if the query successfully completes but fetchProcessedThread throws an error
		// that react-query catches, leading to `error` being set but `data` (and thus `post`) being undefined.
		// The `if (error)` block above should catch this. If somehow error is null and post is null,
		// this is a fallback.
		return (
			<div className="p-4 text-center text-gray-500">
				Post data not available.
			</div>
		);
	}

	if (applyFilters(post, filters)) {
		return null;
	}

	const authorName = post.author.displayName || post.author.handle;
	const postAuthorUrl = getAuthorUrl(post.author.handle);
	const timeAgo = getTimeAgo(post.indexedAt);
	const rootPost =
		isRecord(post.record) && "reply" in post.record
			? post.record.reply?.root
			: null;

	return (
		<article 
			className="border-b border-gray-300 dark:border-gray-600"
			data-post-uri={post.uri}
			data-post-rkey={getPostId(post.uri)}
		>
			<div className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-md p-2">
				<div className="flex flex-col">
					<div className="flex items-center pb-1">
						{displayItems.includes("avatar") && post.author.avatar && (
							<img
								loading="lazy"
								src={post.author.avatar}
								alt={authorName}
								className="w-[42px] h-[42px] rounded-full mr-2.5 flex-shrink-0"
							/>
						)}
						<div className="min-w-0 flex-1 flex flex-col text-sm">
							<div className="flex items-center flex-wrap gap-x-1 min-w-0">
								{displayItems.includes("displayName") && (
									<a
										href={postAuthorUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="max-w-full font-semibold truncate hover:underline"
									>
										{authorName}
									</a>
								)}
								{displayItems.includes("handle") && (
									<a
										href={postAuthorUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="max-w-full break-all text-gray-500"
									>
										{post.author.handle}
									</a>
								)}
								{(displayItems.includes("displayName") ||
									displayItems.includes("handle")) && (
									<span className="text-gray-500">·</span>
								)}
								<a
									href={getPost(post.uri)} // Use post.uri from the fetched post
									target="_blank"
									rel="noopener noreferrer"
									className="text-gray-500 hover:underline"
								>
									{timeAgo}
								</a>
								<QuoteIndicator postUri={post.uri} />
							</div>
							<div className="flex items-center gap-x-1 text-gray-500">
								{rootPost && (
									<a
										href={getPost(rootPost.uri)}
										target="_blank"
										rel="noopener noreferrer"
										className="hover:underline"
									>
										<Icon
											name="arrowUturnLeft"
											className="h-3 w-3 inline-block"
										/>{" "}
										Reply
									</a>
								)}
								{((post.replyCount ?? 0) > 0 || !!replies?.length) && (
									<CollapsePost isExpanded={isExpanded} />
								)}
							</div>
						</div>
					</div>
					<PostText post={post} />
					<PostEmbed post={post} />
					<CompactPostActions post={post} />
				</div>
			</div>
			<PostReplies
				replies={replies} // Pass replies from query
				depth={0}
				isExpanded={isExpanded} // This controls visibility of the direct replies section
				op={post.author.handle}
				filters={filters}
				displayItems={displayItems}
			/>
			{isLoading && initialPost && isExpanded.value && <p className="p-3 text-xs text-gray-500" role="status">Loading replies…</p>}
			{error && initialPost && isExpanded.value && <div className="p-3 text-xs text-gray-600 dark:text-gray-400" role="alert">
				<p>Replies could not be loaded.</p>
				<button type="button" disabled={isFetching} onClick={() => { void refetch(); }}
					className="min-h-10 rounded px-2 underline focus-visible:outline-2 focus-visible:outline-gray-500 disabled:opacity-50">Try again</button>
			</div>}
		</article>
	);
}
