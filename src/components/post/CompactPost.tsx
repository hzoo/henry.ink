import { useSignal } from "@preact/signals-react/runtime";
import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { useQuery } from "@tanstack/react-query";

import { PostText } from "@/src/components/post/PostText";
import { PostReplies } from "@/src/components/post/PostReplies";
import { CompactPostActions } from "@/src/components/post/CompactPostActions";
import { ExpandButton } from "@/src/components/post/ExpandButton";
import { PostEmbed } from "@/src/components/post/PostEmbed";
import { fetchProcessedThread, type Thread } from "@/src/lib/threadUtils";
import type { DisplayableItem } from "@/src/components/post/FullPost";

import { getAuthorUrl, getPost } from "@/src/lib/utils/postUrls";
import { getFormattedDate, getTimeAgo } from "@/src/lib/utils/time";
import { applyFilters, type PostFilter } from "@/src/lib/postFilters";

interface CompactPostProps {
	post: AppBskyFeedDefs.PostView;
	depth?: number;
	expanded?: boolean;
	op?: string;
	filters?: PostFilter[];
	replies?: Thread[] | null;
	displayItems: DisplayableItem[];
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

	const { data: fetchedRepliesData, error: repliesError } = useQuery<
		Thread,
		Error
	>({
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
		<article className="relative min-w-0">
			<div className="flex-1 min-w-0 pb-1 text-gray-500">
				<div className="flex items-center gap-x-1.5 flex-wrap text-sm">
					{isExpanded.value ? (
						displayItems.includes("avatar") &&
						post.author.avatar && (
							<img
								src={post.author.avatar}
								alt={post.author.displayName}
								className="w-[24px] h-[24px] rounded-full flex-shrink-0"
							/>
						)
					) : (
						<ExpandButton post={post} isExpanded={isExpanded} />
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
					<ExpandButton post={post} isExpanded={isExpanded} />
				)}
				{isExpanded.value && (
					<div className="pl-7.5">
						<div className="text-sm break-words text-gray-900 dark:text-gray-100">
							<PostText post={post} />
							<PostEmbed post={post} />
						</div>
						<CompactPostActions post={post} />
					</div>
				)}
			</div>
			{isExpanded.value && (
				<div className="pl-4">
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
				</div>
			)}
		</article>
	);
}
