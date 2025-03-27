import { computed, signal } from "@preact/signals";
import { extractBaseDomain, isDomainWhitelisted } from "./settings";

export const currentUrl = signal<string>("");
export const currentDomain = computed(() => currentUrl.value ? extractBaseDomain(currentUrl.value) : "");
export const isWhitelisted = computed(() => isDomainWhitelisted(currentDomain.value));

// Helper to get the active tab
export async function getActiveTab() {
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	return tab;
}

// Request the current URL when the side panel opens
async function refreshCurrentUrl() {
	try {
		const tab = await getActiveTab();
		if (tab?.id && tab.url) {
			currentUrl.value = tab.url;
			console.log("Current URL:", currentUrl.value);
		}
	} catch (error) {
		console.error("Error fetching active tab:", error);
	}
}

// Setup the messaging for the side panel
export function setupSidePanel() {
	console.log("Setting up side panel");

	// Initial URL fetch
	refreshCurrentUrl();

	// Listen for tab changes
	browser.tabs.onActivated.addListener(refreshCurrentUrl);
	browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
		// {status: 'loading', url: 'https://news.ycombinator.com/'}
		if (changeInfo.status === 'loading' && changeInfo.url) {
			refreshCurrentUrl();
		}
	});

	return {
		refreshCurrentUrl,
	};
}