import { PostText } from "@/components/PostText";
import { getPostUrl, getAuthorUrl } from "@/lib/utils/postUrls";
import { useSignal, useComputed } from "@preact/signals";
import { PostReplies } from "@/components/post/PostReplies";
import { getFormattedDate, getTimeAgo } from "@/lib/utils/time";
import type { AppBskyFeedDefs } from "@atcute/client/lexicons";
import { CompactPostActions } from "@/components/post/CompactPostActions";
import { hoveredCollapsePostUri } from "@/lib/signals";

interface CompactPostProps {
	post: AppBskyFeedDefs.PostView;
	depth?: number;
	expanded?: boolean;
}

export function CompactPost({
	post,
	depth = 0,
	expanded = false,
}: CompactPostProps) {
	const isExpanded = useSignal(expanded);
	const isHoveringThisPost = useComputed(() => hoveredCollapsePostUri.value === post.uri);
	const postUrl = getPostUrl(post.author.handle, post.uri);
	const postAuthorUrl = getAuthorUrl(post.author.handle);
	const timeAgo = getTimeAgo(post.indexedAt);

	return (
		<article className={"relative min-w-0 pl-5"}>
			{isExpanded.value && (
				<div
					className={`absolute left-4 top-0 bottom-0 w-[2px] cursor-pointer transition-colors duration-150 ${
						isHoveringThisPost.value
							? "bg-slate-950 dark:bg-slate-50"
							: "bg-gray-200 dark:bg-gray-700"
					}`}
					onClick={(e) => {
						e.stopPropagation();
						isExpanded.value = false;
					}}
					onMouseEnter={() => (hoveredCollapsePostUri.value = post.uri)}
					onMouseLeave={() => (hoveredCollapsePostUri.value = null)}
					title="Collapse thread"
				/>
			)}

			<div className="flex items-start gap-2 py-1 px-2 hover:bg-gray-50 dark:hover:bg-gray-800">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-x-1.5 flex-wrap text-gray-500 text-sm">
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
					</div>
					<div className="text-sm break-words text-gray-900 dark:text-gray-100">
						<PostText post={post} />
					</div>
					<CompactPostActions post={post} isExpanded={isExpanded}  />
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
