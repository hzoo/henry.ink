import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { PostText } from "@/src/components/post/PostText";
import { PostEmbed } from "@/src/components/post/PostEmbed";
import { CompactPostActions } from "@/src/components/post/CompactPostActions";
import { QuoteIndicator } from "@/src/components/highlights/QuoteIndicator";
import { Icon } from "@/src/components/Icon";
import { getAuthorUrl, getPost, getPostId } from "@/src/lib/utils/postUrls";
import { getTimeAgo } from "@/src/lib/utils/time";
import { isRecord } from "@/src/lib/postActions";

export type DisplayableItem = "avatar" | "displayName" | "handle";

interface ProfilePostProps {
	post: AppBskyFeedDefs.PostView;
	displayItems?: DisplayableItem[];
}

export function ProfilePost({ 
	post, 
	displayItems = ["avatar", "displayName", "handle"] 
}: ProfilePostProps) {
	if (!post || !post.author) {
		return (
			<div className="p-4 text-center text-gray-500">
				Post data not available
			</div>
		);
	}

	const authorName = post.author.displayName || post.author.handle;
	const postAuthorUrl = getAuthorUrl(post.author.handle);
	const timeAgo = getTimeAgo(post.indexedAt);
	const rootPost =
		isRecord(post.record) && "reply" in post.record
			? post.record.reply?.root
			: null;

	return (
		<article 
			className="border-b border-gray-300 dark:border-gray-600"
			data-post-uri={post.uri}
			data-post-rkey={getPostId(post.uri)}
		>
			<div className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-md p-3">
				<div className="flex flex-col">
					<div className="flex items-center pb-1">
						{displayItems.includes("avatar") && post.author.avatar && (
							<img
								src={post.author.avatar}
								alt={authorName}
								className="w-[42px] h-[42px] rounded-full mr-2.5 flex-shrink-0"
							/>
						)}
						<div className="flex flex-col text-sm">
							<div className="flex items-center flex-wrap gap-x-1 min-w-0">
								{displayItems.includes("displayName") && (
									<a
										href={postAuthorUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="font-semibold truncate hover:underline"
									>
										{authorName}
									</a>
								)}
								{displayItems.includes("handle") && (
									<a
										href={postAuthorUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="text-gray-500"
									>
										{post.author.handle}
									</a>
								)}
								{(displayItems.includes("displayName") ||
									displayItems.includes("handle")) && (
									<span className="text-gray-500">·</span>
								)}
								<a
									href={getPost(post.uri)}
									target="_blank"
									rel="noopener noreferrer"
									className="text-gray-500 hover:underline"
								>
									{timeAgo}
								</a>
								<QuoteIndicator postUri={post.uri} />
							</div>
							{rootPost && (
								<div className="flex items-center gap-x-1 text-gray-500">
									<a
										href={getPost(rootPost.uri)}
										target="_blank"
										rel="noopener noreferrer"
										className="hover:underline flex items-center gap-1"
									>
										<Icon
											name="arrowUturnLeft"
											className="h-3 w-3 inline-block"
										/>
										Reply
									</a>
								</div>
							)}
						</div>
					</div>

					<div className="ml-0">
						<div className="text-gray-900 dark:text-gray-100">
							<PostText post={post} />
						</div>
						
						{post.embed && (
							<div className="mt-2">
								<PostEmbed post={post} />
							</div>
						)}

						<div className="mt-2">
							<CompactPostActions post={post} />
						</div>
					</div>
				</div>
			</div>
		</article>
	);
}