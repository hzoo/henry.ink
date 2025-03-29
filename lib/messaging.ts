import { computed, signal } from "@preact/signals";
import { whitelistedDomains } from "./settings";

function extractBaseDomain(url: string): string {
	try {
		const { hostname } = new URL(url);
		return hostname;
	} catch {
		return "";
	}
}

export const currentUrl = signal<string>("");
export const currentDomain = computed(() =>
	currentUrl.value ? extractBaseDomain(currentUrl.value) : "",
);
export const isWhitelisted = computed(() =>
	whitelistedDomains.value.includes(currentDomain.value),
);

// Track the last active tab ID to optimize URL updates
let activeTabId: number | undefined;

// Setup the listener for tab changes
export async function setupTabListener() {
	console.log("Setting up side panel");

	// Initial URL fetch - get current active tab
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	if (tab?.id && tab.url) {
		activeTabId = tab.id;
		currentUrl.value = tab.url;
	}

	// Listen for tab changes
	browser.tabs.onActivated.addListener(async (activeInfo) => {
		activeTabId = activeInfo.tabId;
		const tab = await browser.tabs.get(activeInfo.tabId);
		if (tab.url) {
			currentUrl.value = tab.url;
		}
	});

	// Listen for URL changes
	browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
		// Only update if this is the active tab and there's a URL change
		if (tabId === activeTabId && changeInfo.url) {
			currentUrl.value = changeInfo.url;
		}
	});
}
