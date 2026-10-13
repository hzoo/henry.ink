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
export const quotesUrl = signal('');
export const readerAnchors = signal<Map<string, HTMLElement>>(new Map());

export function showReaderAnchor(id: string): boolean {
	const host = readerAnchors.peek().get(id);
	if (!host) return false;
	window.dispatchEvent(new Event('henry:show-article'));
	host.scrollIntoView({ block: 'center' });
	const details = host.shadowRoot?.querySelector('details');
	if (details) details.open = true;
	return true;
}

// Track which highlight is currently active/focused
export const activeHighlight = signal<string | null>(null);
