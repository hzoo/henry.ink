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

import { getAuthorUrl, getPost } from "@/lib/utils/postUrls";
import { getFormattedDate, getTimeAgo } from "@/lib/utils/time";
import { applyFilters, type PostFilter } from "@/lib/postFilters";

interface CompactPostProps {
	post: AppBskyFeedDefs.PostView;
	depth?: number;
	expanded?: boolean;
	op?: string;
	filters?: PostFilter[];
	replies?: ThreadReply[] | null; // Added: direct replies for this post
}

interface ProcessedThreadData { // This is what fetchProcessedThread returns for THIS post
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
}: CompactPostProps) {
	const isExpanded = useSignal(expanded);
	const postUrl = getPost(post.uri);
	const postAuthorUrl = getAuthorUrl(post.author.handle);
	const timeAgo = getTimeAgo(post.indexedAt);

	const {
		data: fetchedRepliesData, // Contains { post: PostView (of this post), replies: ThreadReply[] (children of this post) }
		error: repliesError,
	} = useQuery<ProcessedThreadData, Error>({
		queryKey: ['thread', post.uri, 'repliesOnly'], // queryKey indicates we are fetching children for post.uri
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
	const actualReplies = initialReplies !== undefined ? initialReplies : (fetchedRepliesData?.replies ?? null);

	return (
		<article className="relative min-w-0 pl-5">
			<ExpandButton post={post} isExpanded={isExpanded} />
			<div className="flex-1 min-w-0 pb-1">
				<div className="flex items-center gap-x-1.5 flex-wrap text-gray-500 text-sm">
					<a
						href={postAuthorUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="hover:underline font-medium text-gray-800 dark:text-gray-100 truncate max-w-[100px]"
						title={post.author.displayName ?? post.author.handle}
					>
						{post.author.handle}
					</a>
					{op === post.author.handle && (
						<span className="ml-1 px-1.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full dark:bg-blue-900 dark:text-blue-300">
							OP
						</span>
					)}
					<span className="text-gray-400">·</span>
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
					{initialReplies === undefined && repliesError && <div className="pl-1 pt-1 text-xs text-red-500">Error: {repliesError.message}</div>}
					{actualReplies && actualReplies.length > 0 && (
						<PostReplies 
							replies={actualReplies} 
							depth={depth + 1} 
							isExpanded={isExpanded} // This isExpanded is for the current CompactPost, PostReplies handles its children based on this
							op={op} 
							filters={filters} 
						/>
					)}
				</>
			)}
		</article>
	);
}
