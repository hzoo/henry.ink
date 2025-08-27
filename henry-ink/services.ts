import { useSignalEffect } from "@preact/signals";
import { useLocation } from "preact-iso";
import { contentStateSignal, contentModeSignal, type ContentMode } from "@/henry-ink/signals";
import { currentUrl } from "@/src/lib/messaging";
import { useEffect } from "preact/hooks";

// URL detection and normalization utilities
function isUrl(input: string): boolean {
	// Already has protocol
	if (input.startsWith('http://') || input.startsWith('https://')) {
		return true;
	}
	
	// Contains a dot and looks domain-like
	// Basic check: has dot, no spaces, reasonable domain pattern
	return /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(\/.*)?$/.test(input.trim());
}

function normalizeUrl(input: string): string | null {
	if (isUrl(input)) {
		return input.startsWith('http') ? input : `https://${input}`;
	}
	// Not a URL - could be search query for future /h/ functionality
	return null;
}

async function fetchSimplifiedContent(inputUrl: string, mode: ContentMode) {
	const normalizedUrl = normalizeUrl(inputUrl);
	
	if (!normalizedUrl) {
		contentStateSignal.value = {
			type: "error",
			message: "Invalid URL provided for fetching. Please enter a valid domain (e.g., example.com).",
			mode,
		};
		return;
	}
	
	const targetUrl = normalizedUrl;

	contentStateSignal.value = { type: "loading", mode };

	try {
		if (mode === 'md') {
			// Original ji.na flow for markdown content
			const jinaUrl = import.meta.env.VITE_JINA_URL || 'http://localhost:8787';
			const response = await fetch(`${jinaUrl}/${targetUrl}`);

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`Worker error: ${response.status} ${response.statusText}. ${errorText}`,
				);
			}
			const content = await response.text();
			
			// Extract title from the content (look for first h1 or title tag)
			let title = '';
			try {
				const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i) || 
								   content.match(/^#\s+(.+)$/m) ||
								   content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
				if (titleMatch) {
					title = titleMatch[1].trim();
				}
			} catch (e) {
				// Ignore title extraction errors
			}
			
			contentStateSignal.value = { type: "success", content, title, mode };
		} else if (mode === 'archive') {
			// New archive service flow for full HTML content
			const archiveUrl = import.meta.env.VITE_ARCHIVE_URL || 'http://localhost:3000';
			const response = await fetch(`${archiveUrl}/api/archive?${new URLSearchParams({ url: targetUrl })}`, {
				method: 'GET',
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`Archive error: ${response.status} ${response.statusText}. ${errorText}`,
				);
			}

			const archive = await response.json();
			
			// Extract text content from HTML for Arena matching
			let textContent = '';
			try {
				const parser = new DOMParser();
				const doc = parser.parseFromString(archive.html, 'text/html');
				textContent = doc.body?.textContent || '';
			} catch (e) {
				console.warn('Failed to extract text from archive HTML:', e);
				textContent = archive.html; // Fallback to raw HTML
			}
			
			contentStateSignal.value = { 
				type: "success", 
				content: textContent, // Text content for Arena enhancement
				title: archive.title,
				mode,
				html: archive.html, // Store full HTML for direct rendering
				css: archive.css, // Store CSS for injection
				htmlAttrs: archive.htmlAttrs,
				bodyAttrs: archive.bodyAttrs
			};
		}
	} catch (e: unknown) {
		console.error("Fetch error:", e);
		contentStateSignal.value = {
			type: "error",
			message: e instanceof Error ? e.message : "An unexpected error occurred while fetching content.",
			mode,
		};
	}
}

// Custom hook to sync URL path from address bar with currentUrl
export function useUrlPathSyncer() {
	const location = useLocation();

	useEffect(() => {
		const currentPath = location.path;
		if (currentPath.length > 1 && currentPath.startsWith("/")) {
			const potentialUrl = currentPath.substring(1); // Remove leading '/'
			const normalizedUrl = normalizeUrl(potentialUrl);
			
			if (normalizedUrl) {
				// It's a valid URL, normalize and set it
				if (currentUrl.value !== normalizedUrl) {
					currentUrl.value = normalizedUrl;
				}
			} else {
				// Not a URL - could be search query, clear currentUrl for now
				// In the future, this could handle /h/ search paths
				if (currentUrl.value) {
					currentUrl.value = "";
				}
			}
		} else if (currentPath === "/") {
			// Clear everything when at root
			if (currentUrl.value) {
				currentUrl.value = "";
			}
		}
	}, [location.path]);
}

// Effect to fetch content when currentUrl or mode changes
export function useContentFetcher() {
	useSignalEffect(() => {
		const url = currentUrl.value;
		const mode = contentModeSignal.value;
		
		if (url && isUrl(url)) {
			fetchSimplifiedContent(url, mode);
		} else {
			// If targetUrl is cleared or invalid, reset to idle
			if (!url) {
				contentStateSignal.value = { type: "idle" };
			}
		}
	});
}
