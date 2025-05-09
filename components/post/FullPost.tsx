import { useSignal, useSignalEffect } from "@preact/signals-react/runtime";

import { PostReplies } from "@/components/post/PostReplies";
import { CompactPostActions } from "@/components/post/CompactPostActions";
import { Icon } from "@/components/Icon";
import { PostEmbed } from "@/components/post/PostEmbed";
import { PostText } from "@/components/post/PostText";

import { getAuthorUrl, getPost, getAtUriFromUrl } from "@/lib/utils/postUrls";
import { getTimeAgo } from "@/lib/utils/time";
import { getThreadSignal } from "@/lib/signals";
import { fetchAndUpdateThreadSignal } from "@/lib/threadUtils";
import { isRecord } from "@/lib/postActions";
import type { PostFilter } from "@/lib/postFilters";
import { applyFilters } from "@/lib/postFilters";

interface FullPostProps {
	uri?: string
	postUri: string;
	filters?: PostFilter[];
}

export function FullPost({ postUri, uri, filters }: FullPostProps) {
	let postUrl: string | undefined;
	if (postUri) {
		postUrl = postUri;
	} else if (uri) {
		postUrl = getAtUriFromUrl(uri);
	}

	if (!postUrl) {
		return <div className="p-4 text-center text-red-500">Error: No valid post identifier provided.</div>;
	}

	const threadStateSignal = getThreadSignal(postUrl);
	const { data, post, isLoading, error } = threadStateSignal.value;
	const isExpanded = useSignal(true);

	useSignalEffect(() => {
		const state = threadStateSignal.peek();
		if (!state.data && !state.isLoading && !state.error) {
			// postUrl is guaranteed to be a string here due to the check above
			fetchAndUpdateThreadSignal(postUrl);
		}
	});

	if (isLoading) {
		return null;
	}

	if (!post) {
		return null;
	}

	if (applyFilters(post, filters)) {
		return null;
	}

	if (error) {
		return (
			<div className="p-4 text-center text-red-500 dark:text-red-400 flex flex-col items-center">
				<span>Error loading post. Please try again later.</span>
				<span className="text-xs text-gray-400 dark:text-gray-500 mt-1">({error})</span>
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
		<article className="border-b border-gray-300 dark:border-gray-600">
			<div className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-md p-2">
				<div className="flex flex-col">
					<div className="flex items-center pb-1">
						{post.author.avatar && (
							<img
								src={post.author.avatar}
								alt={authorName}
								className="w-[42px] h-[42px] rounded-full mr-2.5 flex-shrink-0"
							/>
						)}
						<div className="flex flex-col text-sm">
							<div className="flex items-center flex-wrap gap-x-1 min-w-0">
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
							{rootPost && (
								<a
									href={getPost(rootPost.uri)}
									target="_blank"
									rel="noopener noreferrer"
									className="text-gray-500 hover:underline"
								>
									<Icon name="arrowUturnLeft" className="h-3 w-3 inline-block" /> Reply
								</a>
							)}
						</div>
					</div>
					<PostText post={post} />
					<PostEmbed post={post} />
					<CompactPostActions post={post} />
				</div>
			</div>
			<PostReplies
				replies={data}
				depth={0}
				isExpanded={isExpanded}
				op={post.author.handle}
				filters={filters}
			/>
		</article>
	);
}