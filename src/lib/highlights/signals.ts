import { signal } from "@preact/signals";
import type { AppBskyFeedDefs } from "@atcute/bluesky";

export interface QuoteHighlight {
	id: string;
	postUri: string;
	quote: string;
	ranges: Range[];
	postData: AppBskyFeedDefs.PostView;
}

// Store all extracted quotes with their highlight ranges
export const extractedQuotes = signal<QuoteHighlight[]>([]);

// Track which highlight is currently active/focused
export const activeHighlight = signal<string | null>(null);