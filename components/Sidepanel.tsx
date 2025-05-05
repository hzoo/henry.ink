import { render } from "preact";
import { Sidebar } from "@/components/Sidebar";
import { currentUrl, quotedSelection } from "@/lib/messaging";
import type { BackgroundScriptMessage, SidepanelMessage } from "@/lib/messagingTypes";
import "@/lib/styles.css";

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
		browser.runtime.onMessage.addListener((message: BackgroundScriptMessage) => {
			if (message.from === "content") {
				// Handle QUOTE_SELECTION specifically if needed in background/sidepanel
				if (message.type === "SELECTION") {
					quotedSelection.value = message.data.selection || null;
				}
			}
		});
	} catch (error) {
		console.error("Error setting up tab listener:", error);
	}
}

setupTabListener();

browser.runtime.onMessage.addListener((message: SidepanelMessage, sender, sendResponse) => {
	if (message.type === "PING_SIDEPANEL") {
		// console.log("Sidepanel received PING, sending PONG");
		sendResponse({ type: "PONG_SIDEPANEL", from: "sidepanel" });
		return true;
	}
});

render(<Sidebar />, document.getElementById("app")!);