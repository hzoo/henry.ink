/**
 * Find quote text within DOM content and return text ranges
 */
export function findQuoteInContent(quote: string, container: HTMLElement): Range[] {
	const ranges: Range[] = [];
	
	// Normalize the quote for better matching
	const normalizedQuote = normalizeText(quote);
	
	// Search within common text containers (paragraphs, divs, spans, etc.)
	const textContainers = container.querySelectorAll('p, div, span, article, section, main');
	
	for (const textContainer of textContainers) {
		const containerText = textContainer.textContent || '';
		const normalizedContainerText = normalizeText(containerText);
		
		// Skip if this container is too small or doesn't contain the quote
		if (containerText.length < 50 || !normalizedContainerText.includes(normalizedQuote)) {
			continue;
		}
		
		// Try to find text within this container
		try {
			const range = findTextAcrossNodes(quote, textContainer);
			if (range) {
				ranges.push(range);
				break; // Found it, no need to search other containers
			}
		} catch (error) {
			console.warn('Error finding text in container:', error);
		}
	}
	
	// If not found in text containers, fall back to searching the entire container
	if (ranges.length === 0) {
		try {
			const range = findTextAcrossNodes(quote, container);
			if (range) {
				ranges.push(range);
			}
		} catch (error) {
			console.warn('Error finding text across nodes:', error);
		}
	}
	
	return ranges;
}

/**
 * Find text that may span across multiple text nodes (e.g., due to HTML tags)
 */
function findTextAcrossNodes(searchText: string, container: HTMLElement): Range | null {
	const normalizedSearch = normalizeText(searchText);
	
	// Collect all text nodes
	const walker = document.createTreeWalker(
		container,
		NodeFilter.SHOW_TEXT,
		{
			acceptNode: (node) => {
				const parent = node.parentElement;
				if (parent) {
					const excludedTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TITLE', 'NAV'];
					if (excludedTags.includes(parent.tagName)) {
						return NodeFilter.FILTER_REJECT;
					}
				}
				return NodeFilter.FILTER_ACCEPT;
			}
		}
	);
	
	const textNodes: Text[] = [];
	let node: Node | null;
	while ((node = walker.nextNode())) {
		textNodes.push(node as Text);
	}
	
	// Build a map of normalized text to original positions
	let combinedText = '';
	const nodeMap: Array<{ node: Text; start: number; end: number }> = [];
	
	for (const textNode of textNodes) {
		const text = textNode.textContent || '';
		const start = combinedText.length;
		combinedText += text;
		const end = combinedText.length;
		nodeMap.push({ node: textNode, start, end });
	}
	
	const normalizedCombined = normalizeText(combinedText);
	const index = normalizedCombined.indexOf(normalizedSearch);
	
	if (index === -1) return null;
	
	// Map back to original text positions (simplified)
	const originalStart = mapNormalizedToOriginalIndex(combinedText, normalizedCombined, index);
	const originalEnd = originalStart + searchText.length;
	
	// Find which text nodes contain the start and end
	const startNodeInfo = nodeMap.find(info => originalStart >= info.start && originalStart < info.end);
	const endNodeInfo = nodeMap.find(info => originalEnd > info.start && originalEnd <= info.end);
	
	if (!startNodeInfo || !endNodeInfo) return null;
	
	try {
		const range = document.createRange();
		const startOffset = originalStart - startNodeInfo.start;
		const endOffset = originalEnd - endNodeInfo.start;
		
		range.setStart(startNodeInfo.node, Math.max(0, Math.min(startOffset, startNodeInfo.node.textContent?.length || 0)));
		range.setEnd(endNodeInfo.node, Math.max(0, Math.min(endOffset, endNodeInfo.node.textContent?.length || 0)));
		
		return range;
	} catch (error) {
		console.warn('Error creating cross-node range:', error);
		return null;
	}
}

/**
 * Map normalized text index back to original text index
 */
function mapNormalizedToOriginalIndex(original: string, normalized: string, normalizedIndex: number): number {
	let originalIndex = 0;
	let normalizedPos = 0;
	
	for (let i = 0; i < original.length && normalizedPos <= normalizedIndex; i++) {
		const char = original[i];
		const normalizedChar = normalizeText(char);
		
		if (normalizedChar.length > 0) {
			if (normalizedPos >= normalizedIndex) {
				return i;
			}
			normalizedPos += normalizedChar.length;
		}
		originalIndex = i;
	}
	
	return originalIndex;
}


/**
 * Normalize text for better matching - remove extra whitespace, etc.
 */
function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.replace(/[""'']/g, '"') // Normalize quotes
		.trim();
}

