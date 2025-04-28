import type {
	BackgroundScriptMessage,
} from "@/lib/messagingTypes";

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

		browser.runtime.onMessage.addListener(
			(message: BackgroundScriptMessage) => {
				console.log("Background received message:", message);

				switch (message.type) {
					case "SELECTION": {
						console.log("Received quote selection, attempting to forward:", message.data.selection);
						browser.runtime.sendMessage(message).catch(() => {
							console.warn("Sidepanel not found, cannot forward QUOTE_SELECTION");
						});
						break;
					}
				}

				return false;
			},
		);
	},
});