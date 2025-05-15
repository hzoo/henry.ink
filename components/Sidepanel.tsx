import { render } from "preact";
import { Sidebar } from "@/components/Sidebar";
import { currentUrl, quotedSelection } from "@/lib/messaging";
import "@/lib/styles.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

let activeTabId: number | undefined;
let extensionWindowId: number | undefined;

interface ContentScriptSelectionMessage {
	type: "SELECTION";
	from: "content";
	data: { selection: string };
}

export async function setupTabListener() {
	try {
		const currentWindow = await browser.windows.getCurrent();
		extensionWindowId = currentWindow.id;
		
		const [tab] = await browser.tabs.query({ active: true, windowId: extensionWindowId });
		if (tab?.id && tab.url) {
			activeTabId = tab.id;
			currentUrl.value = tab.url;
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
				} else {
					currentUrl.value = "";
				}
			}
		});
		
		// Listen for URL changes
		browser.tabs.onUpdated.addListener((tabId: number, changeInfo: Browser.tabs.TabChangeInfo) => {
			// Only update if this is the active tab in our window and there's a URL change
			if (tabId === activeTabId && changeInfo.url) {
				currentUrl.value = changeInfo.url;
			}
		});

		// Listen for messages from the content script
		browser.runtime.onMessage.addListener((message: ContentScriptSelectionMessage) => {
			if (message.from === "content" && message.type === "SELECTION") {
				quotedSelection.value = message.data.selection || null;
			}
		});
	} catch (error) {
		console.error("Error setting up tab listener:", error);
	}
}

setupTabListener();

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<Sidebar />
		</QueryClientProvider>
	);
}

render(<App/>, document.getElementById("app")!);