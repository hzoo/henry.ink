import { useSignalEffect } from "@preact/signals-react/runtime";
import { arenaNavigationRequest } from "@/src/lib/messaging";
import { findQuoteInContent } from "@/src/lib/highlights/matchContent";

interface ArenaNavigationControllerProps {
	contentRef: React.RefObject<HTMLElement>;
	enabled?: boolean;
}

/**
 * Handles navigation to Arena channel matches in content
 * Uses the existing highlight system for text matching
 */
export function ArenaNavigationController({ contentRef, enabled = true }: ArenaNavigationControllerProps) {
	// Watch for arena navigation requests
	useSignalEffect(() => {
		const request = arenaNavigationRequest.value;
		if (!request || !contentRef.current || !enabled) return;
		
		// Find the text in the rendered content
		const ranges = findQuoteInContent(request.matchedText, contentRef.current);
		
		if (ranges.length > 0) {
			const range = ranges[0]; // Use first match
			
			// Create temporary highlight with arena-specific styling
			const highlightSpan = document.createElement('span');
			highlightSpan.className = 'arena-match-highlight';
			highlightSpan.style.cssText = `
				background-color: rgba(34, 197, 94, 0.3);
				border-radius: 2px;
				padding: 1px 2px;
				transition: background-color 0.5s ease;
			`;
			
			try {
				range.surroundContents(highlightSpan);
			} catch (e) {
				// Fallback for complex ranges
				const contents = range.extractContents();
				highlightSpan.appendChild(contents);
				range.insertNode(highlightSpan);
			}
			
			// Scroll to the highlighted element
			highlightSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
			
			// Remove highlight after 3 seconds
			setTimeout(() => {
				if (highlightSpan.parentNode) {
					const parent = highlightSpan.parentNode;
					while (highlightSpan.firstChild) {
						parent.insertBefore(highlightSpan.firstChild, highlightSpan);
					}
					parent.removeChild(highlightSpan);
					parent.normalize();
				}
			}, 3000);
		}
	});
	
	// This component doesn't render anything
	return null;
}