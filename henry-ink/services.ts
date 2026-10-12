import { useSignalEffect } from "@preact/signals";
import { apiUrl } from '@/src/lib/api-url';
import { useLocation } from "preact-iso";
import { contentStateSignal, contentModeSignal, contentRevision, type ContentMode } from "@/henry-ink/signals";
import { archiveCache } from "@/henry-ink/reader/archive-cache";
import { currentUrl } from "@/src/lib/messaging";
import { useEffect } from "preact/hooks";
import { resolveEmbedProvider, normalizeWithProvider } from "@/henry-ink/embed/providers";
import "@/henry-ink/embed/youtube";

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

async function fetchSimplifiedContent(inputUrl: string, mode: ContentMode, signal: AbortSignal) {
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

	// Handle third-party embeds (YouTube, Vimeo, etc.) separately
	const embedProvider = resolveEmbedProvider(targetUrl);
	if (embedProvider) {
		const embedMode: ContentMode = 'embed';

		// Force embed mode for embed URLs
		if (contentModeSignal.value !== embedMode) {
			contentModeSignal.value = embedMode;
		}

		contentStateSignal.value = { type: 'loading', mode: embedMode };

		try {
			const normalizedForProvider = normalizeWithProvider(embedProvider, targetUrl);
			const transcriptUrl = apiUrl('/api/youtube/transcript');
			const embed = await embedProvider.fetchContent(normalizedForProvider, {
				fetch: ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal })) as typeof fetch,
				env: {
					transcriptUrl,
				},
			});

			if (signal.aborted) return;
			contentStateSignal.value = {
				type: 'success',
				url: targetUrl,
				content: embed.textContent,
				title: embed.title,
				mode: embedMode,
				embed,
			};
		} catch (e: unknown) {
			if (signal.aborted) return;
			console.error("Embed fetch error:", e);
			contentStateSignal.value = {
				type: 'error',
				message: e instanceof Error ? e.message : 'An unexpected error occurred while fetching embedded content.',
				mode: embedMode,
			};
		}
		return;
	}

	// Regular content fetching for non-embed URLs
	// Reset mode to archive if currently in embed mode (user switched from YouTube to regular page)
	if (mode === 'embed') {
		contentModeSignal.value = 'archive';
		return; // Will re-trigger with correct mode
	}

	contentStateSignal.value = { type: "loading", mode };
	try {
		const archive = await archiveCache.read(targetUrl, mode, signal, () => {
			if (!signal.aborted) contentStateSignal.value = { type: 'loading', mode, message: 'Article service is busy. Waiting to retry...' };
		});
		if (signal.aborted) return;
		contentStateSignal.value = {
			type: "success",
			url: targetUrl,
			content: archive.textContent,
			resolvedUrl: archive.resolvedUrl,
			title: archive.title,
			mode,
			html: archive.html,
			css: archive.css,
			htmlAttrs: archive.htmlAttrs,
			bodyAttrs: archive.bodyAttrs
		};
	} catch (e: unknown) {
		if (signal.aborted) return;
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
		const currentPath = location.url; // Use full URL with query parameters
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
	}, [location.url]);
}

// Effect to fetch content when currentUrl or mode changes
export function useContentFetcher() {
	useSignalEffect(() => {
		const url = currentUrl.value;
		const mode = contentModeSignal.value;
		contentRevision.value;
		const controller = new AbortController();
		
		if (url && isUrl(url)) {
			fetchSimplifiedContent(url, mode, controller.signal);
		} else {
			// If targetUrl is cleared or invalid, reset to idle
			if (!url) {
				contentStateSignal.value = { type: "idle" };
			}
		}
		return () => controller.abort();
	});
}
