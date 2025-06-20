import type { AppBskyFeedDefs } from "@atcute/bluesky";

/**
 * Extract quoted text from a Bluesky post
 * Looks for text starting with >, *, or " following Unclutter's approach
 * Also supports "Name: 'quote'" format
 */
export function extractQuotes(post: AppBskyFeedDefs.PostView): string[] {
	const text = post.record?.text || "";
	if (!text) return [];

	const quotes: string[] = [];
	const lines = text.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();

		// Check for quote patterns
		if (trimmed.startsWith(">")) {
			// Remove > and any following whitespace
			const quote = trimmed.substring(1).trim();
			if (quote.length > 10) {
				// Only meaningful quotes
				quotes.push(quote);
			}
		} else if (trimmed.startsWith("*")) {
			// Remove * and any following whitespace
			const quote = trimmed.substring(1).trim();
			if (quote.length > 10) {
				quotes.push(quote);
			}
		} else if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
			// Remove surrounding quotes
			const quote = trimmed.substring(1, trimmed.length - 1).trim();
			if (quote.length > 10) {
				quotes.push(quote);
			}
		}
	}

	// Also check for "Name: 'quote'" pattern in the full text
	const nameQuoteMatches = extractNameColonQuotes(text);
	quotes.push(...nameQuoteMatches);

	return quotes;
}

/**
 * Extract quotes in "Name: 'quote'" format
 * Simple heuristic: look for colon followed by quoted text
 */
function extractNameColonQuotes(text: string): string[] {
	const quotes: string[] = [];

	// Normalize smart quotes to regular quotes (both left and right)
	const normalizedText = text.replace(/[\u201C\u201D]/g, '"');

	// Find all quoted text - much simpler approach
	const quoteMatches = normalizedText.match(/"([^"]{10,})"/g);

	if (!quoteMatches) return quotes;

	for (const quoteMatch of quoteMatches) {
		// Remove the quote marks
		const quote = quoteMatch.slice(1, -1).trim();

		// Find the position of this quote in the normalized text
		const quoteIndex = normalizedText.indexOf(quoteMatch);

		// Look backwards from the quote to find a colon
		const beforeQuote = normalizedText.substring(0, quoteIndex);
		const colonMatch = beforeQuote.match(/([A-Z][A-Za-z\s.'-]{2,40}):\s*$/);

		if (colonMatch) {
			const name = colonMatch[1].trim();

			// Simple validation: name should be reasonable and quote should be substantial
			if (
				name.length >= 3 &&
				name.length <= 40 &&
				quote.length >= 30 &&
				quote.length <= 1000 &&
				!name.toLowerCase().includes("http")
			) {
				quotes.push(quote);
			}
		}
	}

	return quotes;
}

/**
 * Process an array of posts and extract all quotes
 */
export function extractQuotesFromPosts(
	posts: AppBskyFeedDefs.PostView[],
): Array<{
	post: AppBskyFeedDefs.PostView;
	quotes: string[];
}> {
	return posts
		.map((post) => ({
			post,
			quotes: extractQuotes(post),
		}))
		.filter((item) => item.quotes.length > 0);
}