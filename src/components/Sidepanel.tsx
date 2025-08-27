import { render } from "preact";
import { Sidebar } from "@/src/components/Sidebar";
import { currentUrl, quotedSelection } from "@/src/lib/messaging";
import { showQuotePopupOnSelection } from "@/src/lib/settings";
import { queryClient, appPersister } from "@/src/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";

import "@/src/lib/styles.css";

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

		const [tab] = await browser.tabs.query({
			active: true,
			windowId: extensionWindowId,
		});
		if (tab?.id && tab.url) {
			activeTabId = tab.id;
			currentUrl.value = tab.url;
		}

		browser.tabs.onActivated.addListener(
			async (activeInfo: { windowId: number; tabId: number }) => {
				if (activeInfo.windowId === extensionWindowId) {
					activeTabId = activeInfo.tabId;
					const tab = await browser.tabs.get(activeInfo.tabId);
					if (tab.url) {
						currentUrl.value = tab.url;
					} else if (tab.pendingUrl) {
						currentUrl.value = tab.pendingUrl;
					} else {
						currentUrl.value = "";
					}
				}
			},
		);

		browser.tabs.onUpdated.addListener(
			(tabId: number, changeInfo: { url: string }) => {
				if (tabId === activeTabId && changeInfo.url) {
					currentUrl.value = changeInfo.url;
				}
			},
		);

		browser.runtime.onMessage.addListener(
			(message: ContentScriptSelectionMessage) => {
				if (message.from === "content" && message.type === "SELECTION") {
					quotedSelection.value = message.data.selection || null;
				}
			},
		);
	} catch (error) {
		console.error("Error setting up tab listener:", error);
	}
}

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			{/* @ts-ignore */}
			<Sidebar />
		</QueryClientProvider>
	);
}

browser.runtime.onMessage.addListener(
	(
		message: {
			type: "PING_SIDEPANEL";
			from: "content";
		},
		sender: any,
		sendResponse: (response?: object) => void,
	) => {
		if (message.type === "PING_SIDEPANEL") {
			if (showQuotePopupOnSelection.value) {
				sendResponse({
					type: "PONG_SIDEPANEL",
					from: "sidepanel",
					showPopup: true,
				});
			} else {
				sendResponse({
					type: "PONG_SIDEPANEL",
					from: "sidepanel",
					showPopup: false,
				});
			}
			return true;
		}
	},
);

(async () => {
	try {
		await setupTabListener();
		// Queries are restored lazily via persister.persisterFn, no need for explicit restore
		// await appPersister.restoreQueries(queryClient);
	} catch (error) {
		console.error("Error during initial setup:", error);
	}
	render(<App />, document.getElementById("app")!);
})();
