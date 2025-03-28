import { defineConfig } from 'wxt';
import tailwindcss from "@tailwindcss/vite";
import preact from "@preact/preset-vite";
import svgr from 'vite-plugin-svgr'
// import react from "@vitejs/plugin-react-swc";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: "Bluesky Sidebar",
    description: "See what people are saying about the site you're on",
    version: "0.0.1",
    // https://developer.chrome.com/docs/extensions/reference/api/sidePanel
    permissions: ['storage', 'tabs', 'sidePanel'],
    // host_permissions: ["<all_urls>"],
    action: {}, // Required for sidepanel to open on action click
  },
  extensionApi: 'chrome',
  vite: () => ({
    plugins: [preact(), tailwindcss(), svgr()],
  }),
  runner: {
    chromiumArgs: ["--user-data-dir=./.wxt/chrome-data"],
    startUrls: [
      "https://ciechanow.ski/mechanical-watch/"
    ]
  }
});