import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { FullPost } from "./post/FullPost";
import type { PostFilter } from "@/src/lib/postFilters";
import { Filters } from "@/src/lib/postFilters";
import { useEffect } from "preact/hooks";
import { extractQuotesFromPosts } from "@/src/lib/highlights/extractQuotes";
import {
	extractedQuotes,
	type QuoteHighlight,
} from "@/src/lib/highlights/signals";
import { showCommentDialog } from "@/src/lib/messaging";
import { Icon } from "@/src/components/Icon";

export interface PostListProps {
	posts: AppBskyFeedDefs.PostView[];
}

const filters: PostFilter[] = [
	// Filters.MinInteractionCount(1),
	Filters.NoPins,
	Filters.MaxTags(3),
	Filters.BotPost,
];

export function PostList({ posts }: PostListProps) {
	// Extract quotes from posts when they change (only in website contexts, not extension)
	useEffect(() => {
		// Skip quote extraction in extension contexts
		// Check if we're running inside an extension using WXT's unified browser API
		const isExtensionContext = !!(
			typeof browser !== 'undefined' && 
			browser.runtime && 
			browser.runtime.id
		);
		if (isExtensionContext) {
			return;
		}

		const postsWithQuotes = extractQuotesFromPosts(posts);
		const highlights: QuoteHighlight[] = [];

		postsWithQuotes.forEach(({ post, quotes }) => {
			quotes.forEach((quote, index) => {
				highlights.push({
					id: `${post.uri}-${index}`, // Unique ID for each quote
					postUri: post.uri,
					quote,
					ranges: [], // Will be populated when content is matched
					postData: post,
				});
			});
		});

		// Update the signal with extracted quotes
		extractedQuotes.value = highlights;
	}, [posts]);

	return (
		<>
			{posts.map((post: AppBskyFeedDefs.PostView) => (
				<FullPost
					key={post.cid}
					postUri={post.uri}
					filters={filters}
					displayItems={["avatar", "handle"]}
				/>
			))}
			
			{/* Add comment section */}
			<div className="p-4 mb-96">
				<div className="text-center space-y-3">
					<button
						onClick={() => (showCommentDialog.value = true)}
						className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
					>
						<Icon name="send" className="w-4 h-4 mr-2" />
						Add your comment
					</button>
					<p className="text-xs text-gray-500 dark:text-gray-400">
						Tip: Select{" "}
						<span className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded border border-yellow-200 dark:border-yellow-800/50 font-medium">
							text
						</span>{" "}
						on the page to create an annotation
					</p>
				</div>
			</div>
		</>
	);
}
