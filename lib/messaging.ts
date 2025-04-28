import { computed, signal } from "@preact/signals";
import { whitelistedDomains } from "./settings";

// Message from Content Script (SelectionPopup)
export interface ContentScriptMessage {
	type: "QUOTE_SELECTION";
	from: "content";
	data: { selection: string };
}

export type ExtensionMessage = ContentScriptMessage;

export function extractBaseDomain(url: string): string {
	try {
		const { hostname } = new URL(url);
		return hostname;
	} catch {
		return "";
	}
}

// --- Signals for Sidepanel State ---

export const currentUrl = signal<string>("");
export const currentDomain = computed(() =>
	currentUrl.value ? extractBaseDomain(currentUrl.value) : "",
);
export const isWhitelisted = computed(() =>
	whitelistedDomains.value.includes(currentDomain.value),
);
// Signal to hold the latest selection action data received from the sidepanel
export const quotedSelection = signal<string | null>(null);

// Check if URL is valid for searching (not browser internal, etc)
export const isSearchableUrl = computed(() => {
	const url = currentUrl.value;
	if (!url) return false;
	
	try {
		const parsedUrl = new URL(url);
		// Only allow http and https protocols
		return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
	} catch {
		return false;
	}
});


// Track the active tab and the extension's current window
let activeTabId: number | undefined;
let extensionWindowId: number | undefined;

// Setup the listener for tab changes
export async function setupTabListener() {
	console.log("Setting up side panel");

	// Initial setup - get current window and active tab
	try {
		// Get the current window this extension instance is in
		const currentWindow = await browser.windows.getCurrent();
		extensionWindowId = currentWindow.id;
		
		// Get the active tab in this window
		const [tab] = await browser.tabs.query({ active: true, windowId: extensionWindowId });
		if (tab?.id && tab.url) {
			activeTabId = tab.id;
			currentUrl.value = tab.url;
		}
		
		// Listen for tab changes - only in our window
		browser.tabs.onActivated.addListener(async (activeInfo) => {
			// Only process if this is in our window
			if (activeInfo.windowId === extensionWindowId) {
				activeTabId = activeInfo.tabId;
				
				// Get the tab details
				const tab = await browser.tabs.get(activeInfo.tabId);
				if (tab.url) {
					currentUrl.value = tab.url;
				} else if (tab.pendingUrl) {
					currentUrl.value = tab.pendingUrl;
				} else {
					currentUrl.value = "";
				}
			}
		});
		
		// Listen for URL changes
		browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
			// Only update if this is the active tab in our window and there's a URL change
			if (tabId === activeTabId && changeInfo.url) {
				currentUrl.value = changeInfo.url;
			}
		});

		// Listen for messages from the content script
		browser.runtime.onMessage.addListener((message: ContentScriptMessage) => {
			if (message.from === "content") {
				quotedSelection.value = message.data.selection || null; 
			}
		});
	} catch (error) {
		console.error("Error setting up tab listener:", error);
	}
}
