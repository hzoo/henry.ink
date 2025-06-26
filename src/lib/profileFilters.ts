import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { segmentize } from "@atcute/bluesky-richtext-segmenter";
import { isRecord } from "@/src/lib/postActions";
import { extractQuotes } from "@/src/lib/highlights/extractQuotes";

/**
 * Check if a post contains external links
 */
export function hasLinks(post: AppBskyFeedDefs.PostView): boolean {
	const { record } = post;
	const postRecord = isRecord(record) ? record : null;
	
	if (!postRecord) return false;
	
	const text = postRecord.text ?? "";
	const facets = postRecord.facets ?? [];
	
	// Check for link facets
	if (facets.length > 0) {
		const segments = segmentize(text, facets);
		for (const segment of segments) {
			const feature = segment.features?.[0];
			if (feature && feature.$type === "app.bsky.richtext.facet#link") {
				return true;
			}
		}
	}
	
	// Also check for embeds (external links, images, etc.)
	if (post.embed) {
		// External link embeds
		if (post.embed.$type === "app.bsky.embed.external#view") {
			return true;
		}
		// Record embeds with media (could contain external links)
		if (post.embed.$type === "app.bsky.embed.recordWithMedia#view") {
			return true;
		}
	}
	
	return false;
}

/**
 * Check if a post contains quotes (starts with quote patterns)
 */
export function hasQuotes(post: AppBskyFeedDefs.PostView): boolean {
	const quotes = extractQuotes(post);
	return quotes.length > 0;
}

/**
 * Filter posts to only show those with both links AND quotes
 */
export function filterProfilePosts(posts: AppBskyFeedDefs.PostView[]): AppBskyFeedDefs.PostView[] {
	return posts.filter(post => hasLinks(post) && hasQuotes(post));
}

/**
 * Check if a post is suitable for annotation (has both links and quotes)
 */
export function isAnnotationWorthy(post: AppBskyFeedDefs.PostView): boolean {
	return hasLinks(post) && hasQuotes(post);
}