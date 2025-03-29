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

// Helper to get the active tab
export async function getActiveTab() {
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	return tab;
}

// Request the current URL when the side panel opens
async function setActiveUrl() {
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

// Setup the listener for tab changes
export function setupTabListener() {
	console.log("Setting up side panel");

	// Initial URL fetch
	setActiveUrl();

	// Listen for tab changes
	browser.tabs.onActivated.addListener(() => {
		// activeInfo: {tabId: number, windowId: number}
		setActiveUrl();
	});
	browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
		// {status: 'loading', url: 'https://news.ycombinator.com/'}
		if (changeInfo.status === "loading" && changeInfo.url) {
			// just skip setActiveUrl()
			currentUrl.value = changeInfo.url;
		}
	});
}
