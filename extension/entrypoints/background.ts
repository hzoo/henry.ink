import { createPendingQuotes, selectionFromTab, type SelectionMessage } from "../../src/lib/extension-selection";

const CONTEXT_MENU_ID_SELECTION = "extension-annotation-selection";
const quotes = createPendingQuotes(selection =>
	browser.runtime.sendMessage({ type: "DELIVER_SELECTION", selection } satisfies SelectionMessage),
);

export default defineBackground({
	main() {
		try {
			if (typeof browser.sidePanel?.setPanelBehavior === "function") {
				browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
			}
		} catch (err) {
			console.warn("Could not set side panel behavior:", err);
		}

		browser.runtime.onInstalled.addListener(setupContextMenus);
		browser.contextMenus.onClicked.addListener(handleContextMenuClick);
		browser.tabs.onRemoved.addListener(quotes.remove);
		browser.runtime.onMessage.addListener((message: SelectionMessage, sender) => {
			if (message.type === "SELECTION") {
				const selection = selectionFromTab(message.text, sender.tab, sender.url);
				if (selection) void quotes.enqueue(selection);
			}
			if (message.type === "SIDEPANEL_READY" && sender.url === browser.runtime.getURL("sidepanel.html")) {
				void quotes.send(message.target);
			}
		});
	},
});

export function setupContextMenus() {
	void browser.contextMenus.removeAll().then(() => {
		browser.contextMenus.create({
			id: CONTEXT_MENU_ID_SELECTION,
			title: "Create Bluesky Annotation",
			contexts: ['selection'],
		});
	}).catch(console.error);
}

export function handleContextMenuClick(info: Browser.contextMenus.OnClickData, tab?: Browser.tabs.Tab) {
	if (info.menuItemId !== CONTEXT_MENU_ID_SELECTION) return;
	const selection = selectionFromTab(info.selectionText, tab, info.frameUrl || info.pageUrl || tab?.url);
	if (!selection) return;
	void quotes.enqueue(selection);
	if (typeof browser.sidePanel?.open === "function") {
		void browser.sidePanel.open({ tabId: selection.tabId }).catch(console.error);
	} else if (typeof browser.sidebarAction?.open === "function") {
		void browser.sidebarAction.open().catch(console.error);
	}
}
