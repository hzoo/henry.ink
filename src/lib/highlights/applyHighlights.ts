import { activeHighlight } from "./signals";

/**
 * Apply highlight styling to a text range
 */
export function applyHighlight(range: Range, highlightId: string): HTMLElement {
	// Create highlight span
	const highlightSpan = document.createElement('span');
	highlightSpan.className = 'quote-highlight';
	highlightSpan.dataset.highlightId = highlightId;
	
	// Add styling - subtle background only, no underline
	highlightSpan.style.cssText = `
		background-color: rgba(59, 130, 246, 0.15);
		cursor: pointer;
		transition: all 0.2s ease;
		border-radius: 2px;
		padding: 1px 2px;
	`;
	
	// Add click handler to set as active and scroll to comment
	highlightSpan.addEventListener('click', () => {
		activeHighlight.value = highlightId;
		scrollToComment(highlightId);
	});
	
	// Add hover effects
	highlightSpan.addEventListener('mouseenter', () => {
		highlightSpan.style.backgroundColor = 'rgba(59, 130, 246, 0.25)';
	});
	
	highlightSpan.addEventListener('mouseleave', () => {
		highlightSpan.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
	});
	
	try {
		// Wrap the range content
		range.surroundContents(highlightSpan);
	} catch (error) {
		// If surroundContents fails (e.g., range spans multiple elements),
		// extract and wrap the content manually
		const contents = range.extractContents();
		highlightSpan.appendChild(contents);
		range.insertNode(highlightSpan);
	}
	
	return highlightSpan;
}

/**
 * Remove all highlights from the document
 */
export function clearHighlights(container?: HTMLElement) {
	const root = container || document;
	const highlights = root.querySelectorAll('.quote-highlight');
	
	highlights.forEach(highlight => {
		const parent = highlight.parentNode;
		if (parent) {
			// Move the text content back to parent and remove highlight span
			while (highlight.firstChild) {
				parent.insertBefore(highlight.firstChild, highlight);
			}
			parent.removeChild(highlight);
			
			// Normalize text nodes
			parent.normalize();
		}
	});
}

/**
 * Update highlight visual state based on active highlight
 */
export function updateHighlightStates() {
	const highlights = document.querySelectorAll('.quote-highlight');
	const activeId = activeHighlight.value;
	
	highlights.forEach(highlight => {
		const isActive = highlight.getAttribute('data-highlight-id') === activeId;
		
		if (isActive) {
			highlight.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
		} else {
			highlight.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
		}
	});
}

/**
 * Scroll to the comment in the sidebar
 */
function scrollToComment(highlightId: string) {
	// Extract the post URI from the highlight ID (format: "postUri-index")
	const postUri = highlightId.split('-').slice(0, -1).join('-');
	
	// Try multiple selectors to find the comment
	let commentElement = document.querySelector(`[data-post-uri="${postUri}"]`);
	
	if (!commentElement) {
		// Fallback: look for any element containing the post URI
		commentElement = document.querySelector(`[href*="${postUri}"]`);
	}
	
	if (!commentElement) {
		// Fallback: search for text content (last resort)
		const allPosts = document.querySelectorAll('[data-testid="post"], .post, .full-post');
		for (const post of allPosts) {
			if (post.textContent?.includes(postUri.split('/').pop() || '')) {
				commentElement = post;
				break;
			}
		}
	}
	
	if (commentElement) {
		commentElement.scrollIntoView({ 
			behavior: 'smooth', 
			block: 'center' 
		});
		
		// Add a temporary highlight to the comment
		const originalBg = (commentElement as HTMLElement).style.backgroundColor;
		(commentElement as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
		setTimeout(() => {
			(commentElement as HTMLElement).style.backgroundColor = originalBg;
		}, 2000);
	} else {
		console.warn('Could not find comment element for highlight:', highlightId);
	}
}