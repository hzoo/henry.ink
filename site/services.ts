import { useEffect } from "preact/hooks";
import { useLocation } from "preact-iso";
import {
	isLoadingSignal,
	errorSignal,
	markdownContentSignal,
	inputValueSignal,
} from "@/site/signals";
import { currentUrl } from "@/src/lib/messaging";
import { batch } from "@preact/signals";

const WORKER_BASE_URL = "https://jina_proxy_worker.hi-899.workers.dev";

async function fetchSimplifiedContent(targetUrl: string) {
	if (!targetUrl || !targetUrl.startsWith("http")) {
		errorSignal.value = "Invalid URL provided for fetching.";
		markdownContentSignal.value = null;
		return;
	}

	batch(() => {
		isLoadingSignal.value = true;
		errorSignal.value = null;
		markdownContentSignal.value = null;
	});

	try {
		// The worker expects the target URL as a path segment AFTER the initial slash.
		// So, if targetUrl is "https://example.com", the request path to worker is "/https://example.com"
		const response = await fetch(`${WORKER_BASE_URL}/${targetUrl}`);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Worker error: ${response.status} ${response.statusText}. ${errorText}`,
			);
		}
		markdownContentSignal.value = await response.text();
	} catch (e: any) {
		console.error("Fetch error:", e);
		errorSignal.value =
			e.message || "An unexpected error occurred while fetching content.";
	} finally {
		isLoadingSignal.value = false;
	}
}

// Custom hook to sync URL path from address bar with currentUrl
export function useUrlPathSyncer() {
	const location = useLocation();

	useEffect(() => {
		const currentPath = location.path;
		if (currentPath.length > 1 && currentPath.startsWith("/")) {
			const potentialUrl = currentPath.substring(1); // Remove leading '/'
			if (potentialUrl.startsWith("http")) {
				if (currentUrl.peek() !== potentialUrl) {
					currentUrl.value = potentialUrl;
				}
				if (inputValueSignal.peek() !== potentialUrl) {
					inputValueSignal.value = potentialUrl;
				}
			}
		} else if (currentPath === "/") {
			// Clear everything when at root
			if (currentUrl.peek()) {
				currentUrl.value = "";
			}
			if (inputValueSignal.peek()) {
				inputValueSignal.value = "";
			}
		}
	}, [location.path]);
}

// Effect to fetch content when currentUrl changes
export function useContentFetcher() {
	useEffect(() => {
		if (currentUrl.value?.startsWith("http")) {
			fetchSimplifiedContent(currentUrl.value);
		} else {
			// If targetUrl is cleared or invalid, clear content and potentially error
			markdownContentSignal.value = null;
			if (!currentUrl.value && !inputValueSignal.value) {
				// Only clear error if both are empty
				errorSignal.value = null;
			}
		}
	}, [currentUrl.value]); // Re-run when current URL signal changes
}
