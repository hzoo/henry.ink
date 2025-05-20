import { useSignal } from "@preact/signals-react/runtime";
import { useQuery } from "@tanstack/react-query";
import type { AppBskyFeedDefs } from "@atcute/bluesky";

import { PostReplies } from "@/components/post/PostReplies";
import { CompactPostActions } from "@/components/post/CompactPostActions";
import { Icon } from "@/components/Icon";
import { PostEmbed } from "@/components/post/PostEmbed";
import { PostText } from "@/components/post/PostText";

import { getAuthorUrl, getPost, getAtUriFromUrl } from "@/lib/utils/postUrls";
import { getTimeAgo } from "@/lib/utils/time";
import { fetchProcessedThread } from "@/lib/threadUtils";
import { isRecord } from "@/lib/postActions";
import type { PostFilter } from "@/lib/postFilters";
import { applyFilters } from "@/lib/postFilters";
import type { ThreadReply } from "@/lib/types";
import type { Signal } from "@preact/signals-react";

export type DisplayableItem = 'avatar' | 'displayName' | 'handle';

interface FullPostProps {
	uri?: string;
	postUri?: string;
	filters?: PostFilter[];
	displayItems: DisplayableItem[];
}

interface ProcessedThreadData {
	post: AppBskyFeedDefs.PostView;
	replies: ThreadReply[];
}

function CollapsePost({
	isExpanded,
}: {
	isExpanded: Signal<boolean>;
}) {
	return (
		<span
			className="font-mono flex items-center gap-0.5 text-xs pt-0.5"
			onClick={() => (isExpanded.value = !isExpanded.value)}
		>
			{isExpanded.value ? <Icon name="minusCircle" className="size-4" /> : <Icon name="plusCircle" className="size-4" />}
		</span>
	);
}

export function FullPost({
	postUri: initialPostUri,
	uri,
	filters,
	displayItems,
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

	const {
		data: threadData,
		isLoading,
		error,
	} = useQuery<ProcessedThreadData, Error>({
		queryKey: ["thread", finalPostUri],
		queryFn: () => {
			return fetchProcessedThread(finalPostUri!);
		},
		staleTime: 1000 * 60,
	});

	const post = threadData?.post;
	const replies = threadData?.replies ?? null;

	const isExpanded = useSignal(true);

	if (isLoading) {
		return null;
	}

	if (error) {
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
		<article className="border-b border-gray-300 dark:border-gray-600">
			<div className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-md p-2">
				<div className="flex flex-col">
					<div className="flex items-center pb-1">
						{displayItems.includes('avatar') && post.author.avatar && (
							<img
								src={post.author.avatar}
								alt={authorName}
								className="w-[42px] h-[42px] rounded-full mr-2.5 flex-shrink-0"
							/>
						)}
						<div className="flex flex-col text-sm">
							<div className="flex items-center flex-wrap gap-x-1 min-w-0">
								{displayItems.includes('displayName') && (
									<a
										href={postAuthorUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="font-semibold truncate hover:underline"
									>
										{authorName}
									</a>
								)}
								{displayItems.includes('handle') && (
									<a
										href={postAuthorUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="text-gray-500"
									>
										{post.author.handle}
									</a>
								)}
								{(displayItems.includes('displayName') || displayItems.includes('handle')) && (
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
								{replies && replies.length > 0 && (
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
		</article>
	);
}
