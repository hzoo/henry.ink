export default defineBackground({
	main() {
		try {
			if (
				browser.sidePanel &&
				typeof browser.sidePanel.setPanelBehavior === "function"
			) {
				browser.sidePanel
					.setPanelBehavior({ openPanelOnActionClick: true })
					.catch(console.error);
			}
		} catch (err) {
			console.warn("Could not set side panel behavior:", err);
		}

		browser.runtime.onInstalled.addListener(setupContextMenus);
  		browser.contextMenus.onClicked.addListener(handleContextMenuClick);
	},
});

const CONTEXT_MENU_ID_SELECTION = "extension-annotation-selection";

export function setupContextMenus() {
	browser.contextMenus.removeAll(() => {
	  browser.contextMenus.create({
		id: CONTEXT_MENU_ID_SELECTION,
		title: "Create Bluesky Annotation",
		contexts: ['selection'],
	  });
	});
}

export function handleContextMenuClick(info: Browser.contextMenus.OnClickData) {
	if (info.menuItemId === CONTEXT_MENU_ID_SELECTION) {
		browser.runtime.sendMessage({ 
			type: "SELECTION",
			from: "content",
			data: { selection: info.selectionText } 
		});
	}
}