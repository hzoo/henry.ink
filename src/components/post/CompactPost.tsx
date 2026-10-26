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

import { getAuthorUrl, getPost, getPostId } from "@/src/lib/utils/postUrls";
import { getFormattedDate, getTimeAgo } from "@/src/lib/utils/time";
import { applyFilters, type PostFilter } from "@/src/lib/postFilters";
import { atCuteState } from "@/demo/lib/oauth";

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
	const state = atCuteState.value;
	const rpc = state?.rpc ?? null;

	const { data: fetchedRepliesData, error: repliesError, isFetching, refetch } = useQuery<
		Thread,
		Error
	>({
		queryKey: ["thread", post.uri, state?.session.info.sub ?? null],
		queryFn: ({ signal }) => {
			return fetchProcessedThread(post.uri, signal, rpc);
		},
		enabled: isExpanded.value && initialReplies === undefined && post.replyCount !== 0,
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
		<article className="relative min-w-0" data-post-rkey={getPostId(post.uri)}>
			<div className="flex-1 min-w-0 pb-1 text-gray-500">
				<div className="flex items-center gap-x-1.5 flex-wrap text-sm">
					<ExpandButton isExpanded={isExpanded} />
					{isExpanded.value && (
						displayItems.includes("avatar") &&
						post.author.avatar && (
							<img
								loading="lazy"
								src={post.author.avatar}
								alt={post.author.displayName}
								className="w-[24px] h-[24px] rounded-full flex-shrink-0"
							/>
						)
					)}
					{displayItems.includes("displayName") && (
						<a
							href={postAuthorUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="max-w-full font-semibold truncate hover:underline text-gray-800 dark:text-gray-100"
						>
							{post.author.displayName}
						</a>
					)}
					{displayItems.includes("handle") && (
						<a
							href={postAuthorUrl}
							target="_blank"
							rel="noopener noreferrer"
							className={`max-w-full break-all hover:underline ${op === post.author.handle ? "text-blue-800 bg-blue-100 dark:bg-blue-900 dark:text-blue-300 rounded-full px-1" : "text-gray-600 dark:text-gray-400"}`}
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
					<div className="pl-11">
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
						<div role="alert" className="pl-1 pt-1 text-xs text-red-700 dark:text-red-400">
							<p>Replies could not be loaded.</p>
							<button type="button" disabled={isFetching} onClick={() => { void refetch(); }}
								className="min-h-10 rounded px-2 underline focus-visible:outline-2 focus-visible:outline-gray-500 disabled:opacity-50">Try again</button>
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
