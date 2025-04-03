export default defineBackground({
  main() {
    // Configure the side panel to open when clicking the extension action button
    if (browser.sidePanel) {
      browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  },
}); 