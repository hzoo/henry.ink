import { render } from "preact";
import { Sidebar } from "@/src/components/Sidebar";
import { currentUrl, quotedSelection, showCommentDialog } from "@/src/lib/messaging";
import { showQuotePopupOnSelection } from "@/src/lib/settings";
import { queryClient } from "@/src/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import type { Browser } from "@wxt-dev/browser";
import { trackActiveTab, type SelectionMessage, type TabLocation } from "@/src/lib/extension-selection";

import "@/src/lib/styles.css";

async function setupTabListener() {
	const { id: windowId } = await browser.windows.getCurrent();
	if (windowId === undefined) return;

	const activeTab = trackActiveTab(windowId, url => { currentUrl.value = url; }, target => {
		void browser.runtime.sendMessage({ type: "SIDEPANEL_READY", target } satisfies SelectionMessage).catch(console.error);
	});
	browser.tabs.onActivated.addListener((target: TabLocation) => {
		void activeTab.activate(target, tabId => browser.tabs.get(tabId)).catch(console.error);
	});
	browser.tabs.onUpdated.addListener((tabId: number, { url }: Browser.tabs.OnUpdatedInfo, tab: Browser.tabs.Tab) =>
		activeTab.update({ tabId, windowId: tab.windowId }, url, tab.active),
	);

	browser.runtime.onMessage.addListener((message: SelectionMessage, sender: Browser.runtime.MessageSender, respond: (response: unknown) => void) => {
		if (message.type === "PING_SIDEPANEL") {
			const tab = sender.tab;
			if (tab?.id === undefined || !activeTab.matches({ tabId: tab.id, windowId: tab.windowId })) return;
			respond({
				type: "PONG_SIDEPANEL",
				showPopup: showQuotePopupOnSelection.ready.value && showQuotePopupOnSelection.value,
			});
		}
		if (message.type === "DELIVER_SELECTION" && activeTab.matches(message.selection)) {
			if (!quotedSelection.peek() && !showCommentDialog.peek()) {
				const { text, url } = message.selection;
				quotedSelection.value = { text, url };
			}
			respond(true);
		}
	});

	await activeTab.initialize(browser.tabs.query({ active: true, windowId }));
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
	} catch (error) {
		console.error("Error during initial setup:", error);
	}
	render(<App />, document.getElementById("app")!);
})();
