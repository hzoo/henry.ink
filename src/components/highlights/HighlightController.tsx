import { useEffect } from "preact/hooks";
import { useSignalEffect } from "@preact/signals-react/runtime";
import { extractedQuotes, activeHighlight, type QuoteHighlight } from "@/src/lib/highlights/signals";
import { findQuoteInContent } from "@/src/lib/highlights/matchContent";
import { applyHighlight, clearHighlights, updateHighlightStates } from "@/src/lib/highlights/applyHighlights";

interface HighlightControllerProps {
	contentRef: React.RefObject<HTMLElement>;
}

/**
 * Coordinates quote highlighting - watches for content changes and applies highlights
 */
export function HighlightController({ contentRef }: HighlightControllerProps) {
	// Watch for changes in extracted quotes and apply highlights
	useSignalEffect(() => {
		const quotes = extractedQuotes.value;
		const container = contentRef.current;
		
		if (!container || quotes.length === 0) {
			return;
		}
		
		// Clear existing highlights
		clearHighlights(container);
		
		// Apply new highlights
		quotes.forEach(highlight => {
			const ranges = findQuoteInContent(highlight.quote, container);
			
			// Apply visual highlights
			ranges.forEach(range => {
				applyHighlight(range, highlight.id);
			});
		});
	});
	
	// Watch for active highlight changes and update visual states
	useSignalEffect(() => {
		updateHighlightStates();
	});
	
	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (contentRef.current) {
				clearHighlights(contentRef.current);
			}
		};
	}, []);
	
	// This component doesn't render anything - it's just for effects
	return null;
}