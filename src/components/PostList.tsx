import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { FullPost } from "./post/FullPost";
import type { PostFilter } from "@/src/lib/postFilters";
import { Filters } from "@/src/lib/postFilters";
import { useEffect } from "preact/hooks";
import { extractQuotesFromPosts } from "@/src/lib/highlights/extractQuotes";
import {
	extractedQuotes,
	quotesUrl,
	type QuoteHighlight,
} from "@/src/lib/highlights/signals";
import { showCommentDialog, currentUrl } from "@/src/lib/messaging";
import { Icon } from "@/src/components/Icon";
import { useSignal } from '@preact/signals';

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
	const url = currentUrl.value;
	const visibleCount = useSignal(20);
	useEffect(() => { visibleCount.value = 20; }, [url]);
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
		quotesUrl.value = url;
	}, [posts, url]);

	return (
		<>
			{posts.slice(0, visibleCount.value).map((post: AppBskyFeedDefs.PostView) => (
				<FullPost
					key={post.cid}
					postUri={post.uri}
					initialPost={post}
					filters={filters}
					displayItems={["avatar", "handle"]}
				/>
			))}
			{posts.length > visibleCount.value && <button className="p-4 text-sm underline" onClick={() => visibleCount.value += 20}>Show more discussions</button>}
			
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
					    select page <span className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded border border-yellow-200 dark:border-yellow-800/50 font-medium">
							text
						</span>{" "}
						to annotate
					</p>
				</div>
			</div>
		</>
	);
}
