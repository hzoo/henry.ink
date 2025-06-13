import { useEffect } from "preact/hooks";
import { useLocation } from "preact-iso";
import {
	isLoadingSignal,
	errorSignal,
	markdownContentSignal,
	inputValueSignal,
} from "./signals";
import { currentUrl } from "@/lib/messaging";
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
	const location = useLocation(); // Accesses { url, path, query, route }

	useEffect(() => {
		const currentPath = location.path; // Use location.path as per your interface
		if (currentPath.length > 1 && currentPath.startsWith("/")) {
			const potentialUrl = currentPath.substring(1); // Remove leading '/'
			if (potentialUrl.startsWith("http")) {
				if (currentUrl.peek() !== potentialUrl) {
					currentUrl.value = potentialUrl;
				}
				if (inputValueSignal.peek() !== potentialUrl) {
					inputValueSignal.value = potentialUrl; // Keep input field in sync
				}
			} else {
				// Path doesn't look like a URL, clear current URL if it was set by path
				// This avoids clearing if it was set by input form more recently.
				if (currentUrl.peek() && currentUrl.peek() === potentialUrl) {
					currentUrl.value = "";
				}
			}
		} else {
			// Root path or no specific URL in path
			if (currentUrl.peek() !== "") {
				// currentUrl.value = ""; // Decide if root clears the target or not
			}
		}
	}, [location.path]); // Re-run when path changes
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
