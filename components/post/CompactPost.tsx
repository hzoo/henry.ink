import { PostText } from "../PostText";
import { BasePost, type BasePostProps } from "./BasePost";
import { useSignal } from "@preact/signals-react/runtime";
import { PostReplies } from "@/components/post/PostReplies";
import { getFormattedDate } from "@/lib/utils/time";

export function CompactPost({
	post,
	depth = 0,
}: Omit<BasePostProps, "showReplies" | "onToggleReplies"> & {
	depth?: number;
}) {
	const isExpanded = useSignal(false);

	const {
		postUrl,
		postAuthorUrl,
		authorHandle,
		timeAgo,
		replyCount,
	} = BasePost({ post, isCompact: true });

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
						<button
							onClick={() => window.open(postAuthorUrl, '_blank')}
							className="hover:underline font-medium text-gray-700 dark:text-gray-300 truncate max-w-[120px]"
							title={authorHandle}
						>
							@{authorHandle}
						</button>
						<span className="text-gray-400">·</span>
						<a href={postUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:underline"
                            title={getFormattedDate(post.indexedAt)}
                        >{timeAgo}</a>
						{replyCount !== undefined && replyCount > 0 && (
							<button
								onClick={(e) => {
									e.stopPropagation();
									isExpanded.value = !isExpanded.value;
								}}
								className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
							>
								{isExpanded.value
									? `[-] ${replyCount} replies`
									: `[+] ${replyCount} replies`}
							</button>
						)}
					</div>

					{/* Post content */}
					<div className="text-sm break-words text-gray-900 dark:text-gray-100">
						<PostText
							record={post.record}
							truncate={true}
							hideUrls={false} // We'll show domains in a compact way
						/>
					</div>
				</div>
			</div>

			{isExpanded.value && (
				<PostReplies post={post} replyCount={replyCount} depth={depth + 1} />
			)}
		</article>
	);
}
