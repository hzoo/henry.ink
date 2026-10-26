import { extractedQuotes, readerAnchors, showReaderAnchor } from "@/src/lib/highlights/signals";
import { Icon } from "@/src/components/Icon";
import { contentStateSignal } from "@/henry-ink/signals";
import { currentUrl } from "@/src/lib/messaging";

interface QuoteIndicatorProps {
	postUri: string;
}

/**
 * Shows a subtle indicator when a post contains quotes that are highlighted in the content
 */
export function QuoteIndicator({ postUri }: QuoteIndicatorProps) {
	const placement = readerAnchors.value;
	if (!placement || placement.article !== contentStateSignal.value || placement.article.url !== currentUrl.value
		|| !placement.root.isConnected || placement.quotes !== extractedQuotes.value) return null;
	const postQuote = placement.quotes?.find(quote => quote.postUri === postUri && placement.anchors.has(quote.id));
	if (!postQuote) return null;

	return (
		<button
			onClick={() => showReaderAnchor(postQuote.id)}
			className="flex min-h-10 items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors ml-1"
			aria-label="Show quote in article"
			title="Show quote in article"
		>
			<Icon name="comment" className="w-3 h-3" />
			<span className="text-[9px] font-bold">QUOTE</span>
		</button>
	);
}
