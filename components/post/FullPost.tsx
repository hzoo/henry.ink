import { PostText } from "../PostText";
import { getPostUrl, getAuthorUrl } from "@/lib/utils/postUrls";
import { getTimeAgo } from "@/lib/utils/time";
import type { AppBskyFeedDefs } from "@atcute/client/lexicons";
import { PostReplies } from "./PostReplies";
import { useSignal } from "@preact/signals";
import { ExpandButton } from "@/components/post/ExpandButton";
import { CompactPostActions } from "@/components/post/CompactPostActions";

interface FullPostProps {
	post: AppBskyFeedDefs.PostView;
}

export function FullPost({ post }: FullPostProps) {
	const authorName = post.author.displayName || post.author.handle;
	const postUrl = getPostUrl(post.author.handle, post.uri);
	const postAuthorUrl = getAuthorUrl(post.author.handle);
	const timeAgo = getTimeAgo(post.indexedAt);
	const isExpanded = useSignal(true);

	return (
		<article className="border-b border-gray-300 dark:border-gray-600 pb-2">
			<div className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors p-2 rounded-md">
				<div className="flex flex-col">
					<div className="flex items-center pb-1">
						{post.author.avatar && (
							<img
								src={post.author.avatar}
								alt={authorName}
								className="w-[42px] h-[42px] rounded-full mr-2.5 flex-shrink-0"
							/>
						)}
						<div className="flex items-center flex-wrap gap-x-1 min-w-0 text-sm">
							<a
								href={postAuthorUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="font-semibold truncate hover:underline"
							>
								{authorName}
							</a>
							<a
								href={postAuthorUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-gray-500"
							>
								@{post.author.handle}
							</a>
							<span className="text-gray-500">·</span>
							<a
								href={postUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-gray-500 hover:underline"
							>
								{timeAgo}
							</a>
						</div>
					</div>
					<PostText post={post} />
					<CompactPostActions post={post} isExpanded={isExpanded} />
				</div>
			</div>
			<PostReplies post={post} depth={0} isExpanded={isExpanded} />
		</article>
	);
}
