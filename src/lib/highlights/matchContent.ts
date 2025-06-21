/**
 * Find quote text within DOM content and return text ranges
 */
export function findQuoteInContent(quote: string, container: HTMLElement): Range[] {
	const ranges: Range[] = [];
	
	// Normalize the quote for better matching
	const normalizedQuote = normalizeText(quote);
	
	// Search within common text containers (paragraphs, divs, spans, etc.)
	const textContainers = container.querySelectorAll('p, div, span, article, section, main');
	
	for (let i = 0; i < textContainers.length; i++) {
		const textContainer = textContainers[i] as HTMLElement;
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
				// For most quotes, first good match is sufficient
				if (textContainer.tagName === 'P' && textContainer.textContent!.length > 200) {
					break; // Prioritize substantial paragraphs
				}
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
	
	// If we have multiple matches, prefer the best one
	if (ranges.length > 1) {
		const bestRange = selectBestMatch(ranges);
		return bestRange ? [bestRange] : ranges;
	}
	
	return ranges;
}

/**
 * Select the best match from multiple ranges
 * Prefers matches in paragraphs over headings, and avoids highlighted/special elements
 */
function selectBestMatch(ranges: Range[]): Range | null {
	if (ranges.length === 0) return null;
	if (ranges.length === 1) return ranges[0];
	
	// Score each range based on its context
	const scoredRanges = ranges.map((range) => {
		let score = 0;
		const container = range.commonAncestorContainer;
		const element = container.nodeType === Node.ELEMENT_NODE 
			? container as Element 
			: container.parentElement;
		
		if (!element) return { range, score: -1 };
		
		// Prefer paragraph-like elements
		if (element.tagName === 'P') score += 10;
		if (element.tagName === 'DIV') score += 5;
		if (element.tagName === 'SPAN') score += 3;
		
		// Penalize heading elements
		if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) score -= 15;
		
		// Penalize elements that are already highlighted or special
		if (element.classList.contains('highlight') || 
			element.classList.contains('selected') ||
			(element as HTMLElement).style.backgroundColor) score -= 10;
		
		// Prefer longer containing elements (usually main content)
		const textLength = element.textContent?.length || 0;
		if (textLength > 500) score += 5;
		if (textLength > 1000) score += 3;
		
		return { range, score };
	});
	
	// Return the highest scoring range
	const best = scoredRanges.reduce((prev, current) => 
		current.score > prev.score ? current : prev
	);
	
	return best.score > 0 ? best.range : ranges[0]; // Fallback to first if all scores are poor
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
	
	// Map back to original text positions
	const originalStart = mapNormalizedToOriginalIndex(combinedText, normalizedCombined, index);
	const originalEnd = mapNormalizedToOriginalIndex(combinedText, normalizedCombined, index + normalizedSearch.length);
	
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
	let pos = 0;
	let normalizedCount = 0;
	
	for (let i = 0; i < original.length && normalizedCount < normalizedIndex; i++) {
		const char = original[i];
		if (/\s/.test(char)) {
			// Count only the first space in a sequence
			if (i === 0 || !/\s/.test(original[i - 1])) {
				normalizedCount++;
			}
		} else {
			normalizedCount++;
		}
		pos = i + 1;
	}
	return pos;
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

