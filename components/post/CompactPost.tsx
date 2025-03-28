import { PostText } from "../PostText";
import { getPostUrl, getAuthorUrl } from "../../lib/utils/postUrls";
import { useSignal } from "@preact/signals-react/runtime";
import { PostReplies } from "@/components/post/PostReplies";
import { getFormattedDate, getTimeAgo } from "@/lib/utils/time";
import { Icon } from "@/components/Icon";
import type { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";

interface CompactPostProps {
	post: PostView;
	depth?: number;
}

export function CompactPost({
	post,
	depth = 0,
}: CompactPostProps) {
	const isExpanded = useSignal(false);
	const postUrl = getPostUrl(post.author.handle, post.uri);
	const postAuthorUrl = getAuthorUrl(post.author.handle);
	const timeAgo = getTimeAgo(post.indexedAt);

	return (
		<article className={`relative min-w-0 ${depth > 0 ? "pl-3" : ""}`}>
			{/* Thread line */}
			{depth > 0 && (
				<div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
			)}

			<div className="flex items-start gap-2 py-1 px-3 hover:bg-gray-50 dark:hover:bg-gray-800">
				<div className="flex-1 min-w-0">
					{/* Post metadata row */}
					<div className="flex items-center gap-x-1.5 text-sm flex-wrap text-gray-500">
						<a
							href={postAuthorUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="hover:underline font-medium text-gray-800 dark:text-gray-600 truncate max-w-[120px]"
							title={post.author.handle}
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
							<button
								onClick={(e) => {
									e.stopPropagation();
									isExpanded.value = !isExpanded.value;
								}}
								className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
							>
								<span className="flex items-center gap-1">
									{isExpanded.value ? "[-]" : "[+]"}
									<Icon name="comment" className="w-3 h-3" />
									{post.replyCount}
								</span>
							</button>
						)}
					</div>

					{/* Post content */}
					<div className="text-sm break-words text-gray-900 dark:text-gray-100">
						<PostText record={post.record} truncate={true} />
					</div>
				</div>
			</div>

			{isExpanded.value && (
				<PostReplies post={post} replyCount={post.replyCount} depth={depth + 1} />
			)}
		</article>
	);
}
