import { signal } from "@preact/signals";
import type { AppBskyFeedDefs } from "@atcute/bluesky";
import type { ArticleContent } from "@/henry-ink/signals";

export interface QuoteHighlight {
	id: string;
	postUri: string;
	quote: string;
	postData: AppBskyFeedDefs.PostView;
}

// Extracted quotes and completed placement in the current reader document.
export const extractedQuotes = signal<QuoteHighlight[]>([]);
export const quotesUrl = signal('');
export const readerAnchors = signal<{
	article: ArticleContent;
	root: HTMLElement;
	quotes: QuoteHighlight[] | null;
	anchors: Map<string, HTMLElement>;
} | null>(null);
export const targetPostRkey = signal<string | null>(null);

export function showReaderAnchor(id: string): boolean {
	const host = readerAnchors.peek()?.anchors.get(id);
	if (!host?.isConnected) return false;
	window.dispatchEvent(new Event('henry:show-article'));
	const note = Array.from(host.shadowRoot?.querySelectorAll<HTMLElement>('[data-note-id]') ?? [])
		.find(element => element.dataset.noteId === id);
	if (note?.tagName === 'DETAILS') (note as HTMLDetailsElement).open = true;
	const target = note?.querySelector<HTMLElement>('summary, .attribution') || note || host;
	// Open first so scrolling uses the expanded note's actual dimensions.
	if (host.getBoundingClientRect().height > (host.ownerDocument.defaultView?.innerHeight ?? Infinity)) target.scrollIntoView({ block: 'start' });
	else host.scrollIntoView({ block: 'center' });
	window.requestAnimationFrame(() => {
		// Mobile Notes closes during the same render. Focus after article inertness
		// has cleared, and only while this exact target remains in the document.
		if (target.isConnected) target.focus({ preventScroll: true });
	});
	return true;
}
