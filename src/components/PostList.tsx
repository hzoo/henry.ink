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
			<div className="pb-96" />
		</>
	);
}
