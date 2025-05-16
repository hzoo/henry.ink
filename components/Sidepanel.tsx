import { render } from "preact";
import { Sidebar } from "@/components/Sidebar";
import { currentUrl, quotedSelection } from "@/lib/messaging";
import "@/lib/styles.css";
import { queryClient, appPersister } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";

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
		
		browser.tabs.onActivated.addListener(async (activeInfo: Browser.tabs.TabActiveInfo) => {
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
		});
		
		browser.tabs.onUpdated.addListener((tabId: number, changeInfo: Browser.tabs.TabChangeInfo) => {
			if (tabId === activeTabId && changeInfo.url) {
				currentUrl.value = changeInfo.url;
			}
		});

		browser.runtime.onMessage.addListener((message: ContentScriptSelectionMessage) => {
			if (message.from === "content" && message.type === "SELECTION") {
				quotedSelection.value = message.data.selection || null;
			}
		});
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

(async () => {
	try {
		await setupTabListener();
		await appPersister.persisterRestoreAll(queryClient);
		console.log("Persisted queries restored.");
	} catch (error) {
		console.error("Error during initial setup or restore:", error);
	}
	render(<App/>, document.getElementById("app")!);
})();