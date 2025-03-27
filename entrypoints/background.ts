export default defineBackground({
  main() {
    // Configure the side panel to open when clicking the extension action button
    browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  },
}); 