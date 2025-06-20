import { useSignal, useSignalEffect } from "@preact/signals-react/runtime";
import { extractedQuotes } from "@/src/lib/highlights/signals";
import { Icon } from "@/src/components/Icon";

interface QuoteIndicatorProps {
	postUri: string;
}

/**
 * Shows a subtle indicator when a post contains quotes that are highlighted in the content
 */
export function QuoteIndicator({ postUri }: QuoteIndicatorProps) {
	const hasQuote = useSignal(false);

	// Check if this post has any quotes
	useSignalEffect(() => {
		const quotes = extractedQuotes.value;
		hasQuote.value = quotes.some((quote) => quote.postUri === postUri);
	});

	if (!hasQuote.value) {
		return null;
	}

	const scrollToQuote = () => {
		// Find the first highlight for this post
		const quotes = extractedQuotes.value;
		const postQuote = quotes.find((quote) => quote.postUri === postUri);

		if (postQuote) {
			// Find the highlight element in the page
			const highlightElement = document.querySelector(
				`[data-highlight-id="${postQuote.id}"]`,
			);

			if (highlightElement) {
				highlightElement.scrollIntoView({
					behavior: "smooth",
					block: "center",
				});

				// Add a subtle pulse effect to draw attention
				const originalBackground = (highlightElement as HTMLElement).style
					.backgroundColor;
				(highlightElement as HTMLElement).style.backgroundColor =
					"rgba(59, 130, 246, 0.4)";
				setTimeout(() => {
					(highlightElement as HTMLElement).style.backgroundColor =
						originalBackground;
				}, 1000);
			}
		}
	};

	return (
		<button
			onClick={scrollToQuote}
			className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors ml-1"
			title="This quote is highlighted in the article. Click to jump to it."
		>
			<Icon name="comment" className="w-3 h-3" />
			<span className="text-[9px] font-bold">QUOTE</span>
		</button>
	);
}
