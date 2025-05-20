import { useSignal } from "@preact/signals-react/runtime";
import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { useQuery } from "@tanstack/react-query";

import { PostText } from "@/components/post/PostText";
import { PostReplies } from "@/components/post/PostReplies";
import { CompactPostActions } from "@/components/post/CompactPostActions";
import { ExpandButton } from "@/components/post/ExpandButton";
import { PostEmbed } from "@/components/post/PostEmbed";
import { fetchProcessedThread } from "@/lib/threadUtils";
import type { ThreadReply } from "@/lib/types";
import type { Signal } from "@preact/signals-react";
import type { DisplayableItem } from "@/components/post/FullPost";

import { getAuthorUrl, getPost } from "@/lib/utils/postUrls";
import { getFormattedDate, getTimeAgo } from "@/lib/utils/time";
import { applyFilters, type PostFilter } from "@/lib/postFilters";

interface CompactPostProps {
	post: AppBskyFeedDefs.PostView;
	depth?: number;
	expanded?: boolean;
	op?: string;
	filters?: PostFilter[];
	replies?: ThreadReply[] | null;
	displayItems: DisplayableItem[];
}

interface ProcessedThreadData {
	// This is what fetchProcessedThread returns for THIS post
	post: AppBskyFeedDefs.PostView;
	replies: ThreadReply[];
}

export function CompactPost({
	post,
	depth = 0,
	expanded = false,
	op,
	filters,
	replies: initialReplies,
	displayItems,
}: CompactPostProps) {
	const isExpanded = useSignal(expanded);
	const postUrl = getPost(post.uri);
	const postAuthorUrl = getAuthorUrl(post.author.handle);
	const timeAgo = getTimeAgo(post.indexedAt);

	const {
		data: fetchedRepliesData, // Contains { post: PostView (of this post), replies: ThreadReply[] (children of this post) }
		error: repliesError,
	} = useQuery<ProcessedThreadData, Error>({
		queryKey: ["thread", post.uri],
		queryFn: () => {
			return fetchProcessedThread(post.uri);
		},
		enabled: isExpanded.value && initialReplies === undefined,
		staleTime: 1000 * 60,
	});

	if (applyFilters(post, filters)) {
		return null;
	}

	// Determine which replies to show: prop > fetched > null
	const actualReplies =
		initialReplies !== undefined
			? initialReplies
			: (fetchedRepliesData?.replies ?? null);

	return (
		<article className="relative min-w-0 pl-4">
			<ExpandButton post={post} isExpanded={isExpanded} />
			<div className="flex-1 min-w-0 pb-1">
				<div className="flex items-center gap-x-1.5 flex-wrap text-gray-500 text-sm">
					{displayItems.includes("avatar") && post.author.avatar && (
						<img
							src={post.author.avatar}
							alt={post.author.displayName}
							className="w-[24px] h-[24px] rounded-full flex-shrink-0"
						/>
					)}
					{displayItems.includes("displayName") && (
						<a
							href={postAuthorUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="font-semibold truncate hover:underline text-gray-800 dark:text-gray-100"
						>
							{post.author.displayName}
						</a>
					)}
					{displayItems.includes("handle") && (
						<a
							href={postAuthorUrl}
							target="_blank"
							rel="noopener noreferrer"
							className={`hover:underline ${op === post.author.handle ? "text-blue-800 bg-blue-100 dark:bg-blue-900 dark:text-blue-300 rounded-full px-1" : "text-gray-600 dark:text-gray-400"}`}
							title={post.author.displayName ?? post.author.handle}
						>
							{post.author.handle}
						</a>
					)}
					{displayItems.includes("handle") &&
						(op === post.author.handle || timeAgo) && (
							<span className="text-gray-400">·</span>
						)}
					<a
						href={postUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-gray-400 hover:underline"
						title={getFormattedDate(post.indexedAt)}
					>
						{timeAgo}
					</a>
				</div>
				{isExpanded.value && (
					<>
						<div className="text-sm break-words text-gray-900 dark:text-gray-100">
							<PostText post={post} />
							<PostEmbed post={post} />
						</div>
						<CompactPostActions post={post} />
					</>
				)}
			</div>
			{isExpanded.value && (
				<>
					{/* Show loading/error only if we are the ones fetching (initialReplies was undefined) */}
					{initialReplies === undefined && repliesError && (
						<div className="pl-1 pt-1 text-xs text-red-500">
							Error: {repliesError.message}
						</div>
					)}
					{actualReplies && actualReplies.length > 0 && (
						<PostReplies
							replies={actualReplies}
							depth={depth + 1}
							isExpanded={isExpanded}
							op={op}
							filters={filters}
							displayItems={displayItems}
						/>
					)}
				</>
			)}
		</article>
	);
}
