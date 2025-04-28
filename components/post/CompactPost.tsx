import { PostText } from "@/components/PostText";
import { getPostUrl, getAuthorUrl } from "@/lib/utils/postUrls";
import { useSignal } from "@preact/signals";
import { PostReplies } from "@/components/post/PostReplies";
import { getFormattedDate, getTimeAgo } from "@/lib/utils/time";
import type { AppBskyFeedDefs } from "@atcute/client/lexicons";
import { CompactPostActions } from "@/components/post/CompactPostActions";
import { ExpandButton } from "@/components/post/ExpandButton";

interface CompactPostProps {
	post: AppBskyFeedDefs.PostView;
	depth?: number;
	expanded?: boolean;
	op?: string;
}

export function CompactPost({
	post,
	depth = 0,
	expanded = false,
	op,
}: CompactPostProps) {
	const isExpanded = useSignal(expanded);
	const postUrl = getPostUrl(post.author.handle, post.uri);
	const postAuthorUrl = getAuthorUrl(post.author.handle);
	const timeAgo = getTimeAgo(post.indexedAt);

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
						title={post.author.displayName}
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
						</div>
						<CompactPostActions post={post} />
					</>
				)}
			</div>
			{isExpanded.value && (
				<PostReplies post={post} depth={depth + 1} isExpanded={isExpanded} op={op} />
			)}
		</article>
	);
}
