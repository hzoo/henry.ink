import { render } from "preact";
import { Sidebar } from "@/components/Sidebar";
import { currentUrl, quotedSelection } from "@/lib/messaging";
import type { BackgroundScriptMessage, SidepanelMessage } from "@/lib/messagingTypes";
import "@/lib/styles.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

let activeTabId: number | undefined;
let extensionWindowId: number | undefined;

function isInjected() {
	console.log("Checking if popup is injected", !!document.getElementById('extension-annotation-popup'));
	return document.getElementById('extension-annotation-popup') !== null;
}

const css = `
.selection-popup {
  font-family: ui-sans-serif, system-ui, sans-serif;
  line-height: 1.5;
  font-size: 12px;
  position: absolute;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.25rem; /* gap-1 */
  border-radius: 0.5rem; /* rounded-lg */
  border-width: 1px; /* border */
  border-style: solid;
  padding: 0.25rem; /* p-1 */
  white-space: nowrap;
  min-width: max-content;
  transition-property: all;
  transition-duration: 150ms;
  transition-timing-function: cubic-bezier(0, 0, 0.2, 1); /* ease-out */
  /* Base colors */
  background-color: #ffffff; /* bg-white */
  border-color: #bfdbfe; /* border-blue-200 */
}

/* Conditional styles (adjust based on your implementation needs) */
.selection-popup.is-animating {
  margin-top: 0.25rem; /* mt-1 */
  background-color: #dbeafe; /* bg-blue-100 */
}

/* Dark mode base colors (adjust based on your implementation needs) */
@media (prefers-color-scheme: dark) {
  .selection-popup {
    background-color: #1f2937; /* dark:bg-gray-800 */
    border-color: rgba(147, 197, 253, 0.3); /* dark:border-blue-300/30 */
  }
  .selection-popup.is-animating {
    background-color: rgba(59, 130, 246, 0.5); /* dark:bg-blue-700/50 */
  }
}

.selection-popup button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.25rem; /* gap-1 */
  border-radius: 0.25rem; /* rounded */
  padding-left: 0.375rem; /* px-1.5 */
  padding-right: 0.375rem; /* px-1.5 */
  padding-top: 0.25rem; /* py-1 */
  padding-bottom: 0.25rem; /* py-1 */
  color: #374151; /* text-gray-700 */
  /* Hover */
  /* background-color: #dbeafe; /* hover:bg-blue-100 *//*/
}

/* Dark mode button base and hover colors (adjust based on your implementation needs) */
@media (prefers-color-scheme: dark) {
  .selection-popup button {
    color: #d1d5db; /* dark:text-gray-300 */
  }
  .selection-popup button:hover {
     /* background-color: rgba(59, 130, 246, 0.5); /* dark:hover:bg-blue-700/50 *//*/
  }
}

.selection-popup kbd {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.125rem; /* rounded-sm */
  background-color: #e5e7eb; /* bg-gray-200 */
  padding-left: 0.25rem; /* px-1 */
  padding-right: 0.25rem; /* px-1 */
  padding-top: 0.125rem; /* py-0.5 */
  padding-bottom: 0.125rem; /* py-0.5 */
  font-size: 0.75rem; /* text-xs */
  color: #111827; /* text-gray-900 */
}

/* Dark mode kbd colors (adjust based on your implementation needs) */
@media (prefers-color-scheme: dark) {
  .selection-popup kbd {
    background-color: #4b5563; /* dark:bg-gray-600 */
    color: #f3f4f6; /* dark:text-gray-100 */
  }
}
`;

function injectPopup(tabId: number) {
	chrome.scripting.executeScript({
		target: { tabId },
		func: isInjected,
	}).then((results) => {
		if (!results[0].result) {
			console.log("Injecting popup", tabId);
			chrome.scripting.insertCSS({
				target: { tabId },
				css,
			});
			chrome.scripting.executeScript({
				target: { tabId },
				files: ["content-scripts/popup.js"],
			});
		} else {
			console.log("Popup already injected", tabId);
		}
	});
}

export async function setupTabListener() {
	try {
		const currentWindow = await browser.windows.getCurrent();
		extensionWindowId = currentWindow.id;
		
		const [tab] = await browser.tabs.query({ active: true, windowId: extensionWindowId });
		if (tab.id) {
			activeTabId = tab.id;
			currentUrl.value = tab.url;
			injectPopup(tab.id);
		}
		
		// Listen for tab changes - only in our window
		browser.tabs.onActivated.addListener(async (activeInfo: Browser.tabs.TabActiveInfo) => {
			// Only process if this is in our window
			if (activeInfo.windowId === extensionWindowId) {
				activeTabId = activeInfo.tabId;
				
				// Get the tab details
				const tab = await browser.tabs.get(activeInfo.tabId);
				if (tab.url) {
					currentUrl.value = tab.url;
				} else if (tab.pendingUrl) {
					currentUrl.value = tab.pendingUrl;
				}
				injectPopup(tab.id);
			}
		});
		
		// Listen for URL changes
		browser.tabs.onUpdated.addListener((tabId: number, changeInfo: Browser.tabs.TabChangeInfo) => {
			// Only update if this is the active tab in our window and there's a URL change
			if (tab.windowId === extensionWindowId && tabId === activeTabId && changeInfo.url) {
				currentUrl.value = changeInfo.url;
				injectPopup(tab.id);
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

browser.runtime.onMessage.addListener((message: SidepanelMessage, sender: Browser.runtime.MessageSender, sendResponse: (response?: object) => void) => {
	if (message.type === "PING_SIDEPANEL") {
		sendResponse({ type: "PONG_SIDEPANEL", from: "sidepanel" });
		return true;
	}
});

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<Sidebar />
		</QueryClientProvider>
	);
}

render(<App/>, document.getElementById("app")!);