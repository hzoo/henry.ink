import { PostText } from "@/components/PostText";
import { getPostUrl, getAuthorUrl } from "@/lib/utils/postUrls";
import { useComputed, useSignal } from "@preact/signals";
import { PostReplies } from "@/components/post/PostReplies";
import { getFormattedDate, getTimeAgo } from "@/lib/utils/time";
import type { Signal } from "@preact/signals-core";
import type { AppBskyFeedDefs } from "@atcute/client/lexicons";
import { CompactPostActions } from "./CompactPostActions";
import { getThreadSignal } from "@/lib/signals";

interface CompactPostProps {
	post: AppBskyFeedDefs.PostView;
	depth?: number;
	expanded?: boolean;
}

function ExpandButton({ post, isExpanded }: { post: AppBskyFeedDefs.PostView, isExpanded: Signal<boolean> }) {
	const threadSignal = getThreadSignal(post.uri);
	const displayedReplyCount = useComputed(() => {
		const signalData = threadSignal.value.data;
		return Array.isArray(signalData) ? signalData.length : post.replyCount ?? 0;
	  });

	  
	return (<button
		onClick={(e) => {
			e.stopPropagation();
			isExpanded.value = !isExpanded.value;
		}}
		className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-mono"
	>
		<span className="flex items-center gap-0.5 text-xs">
			{isExpanded.value ? "[-]" : `[+${displayedReplyCount.value}]`}
		</span>
	</button>)
}

export function CompactPost({
	post,
	depth = 0,
	expanded = false,
}: CompactPostProps) {
	const isExpanded = useSignal(expanded);
	const postUrl = getPostUrl(post.author.handle, post.uri);
	const postAuthorUrl = getAuthorUrl(post.author.handle);
	const timeAgo = getTimeAgo(post.indexedAt);

	return (
		<article className={`relative min-w-0 ${depth > 0 ? "pl-3" : ""}`}>
			{/* Thread line */}
			{depth > 0 && (
				<div className="absolute left-2 top-0 bottom-0 w-[2px] bg-gray-200 dark:bg-gray-700" />
			)}

			<div className="flex items-start gap-2 py-1 px-2 hover:bg-gray-50 dark:hover:bg-gray-800">
				<div className="flex-1 min-w-0">
					{/* Post metadata row */}
					<div className="flex items-center gap-x-1.5 flex-wrap text-gray-500">
						<a
							href={postAuthorUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="hover:underline font-medium text-gray-800 dark:text-gray-600 truncate max-w-[100px]"
							title={post.author.displayName}
						>
							@{post.author.handle}
						</a>
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
						{post.replyCount !== undefined && post.replyCount > 0 && (
							<ExpandButton post={post} isExpanded={isExpanded} />
						)}
					</div>
					{/* Post content */}
					<div className="text-sm break-words text-gray-900 dark:text-gray-100">
						<PostText post={post} />
					</div>
					<CompactPostActions post={post} />
				</div>
			</div>
			<PostReplies 
				post={post} 
				depth={depth + 1} 
				isExpanded={isExpanded} 
			/>
		</article>
	);
}
