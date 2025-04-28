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
	},
});