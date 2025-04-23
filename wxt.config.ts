import { defineConfig } from 'wxt';
import tailwindcss from "@tailwindcss/vite";
import preact from "@preact/preset-vite";
import svgr from 'vite-plugin-svgr'
import { version } from './package.json';
import { injectOauthEnv } from './vite.config';
import type { PluginOption } from 'vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: "Bluesky Sidebar",
    description: "See what people are saying about the site you're on",
    version: version,
    // This key ensures the extension ID is consistent across builds.
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0HvtHayny9zfPXB1QgdZVfPggiLY5RXxD0IKtquHr9X/iWQ+I0YNVWgPGjXZgKSAkzMQpudpbgxZCsx7vqPLLXwEzJ9dn8+vy2AIijokcOeDYlsA44XL0BiSyAeAmFOet1yiD/nvdtGqBbVHTliOZ5PL9Ud9g3WTwA4R8x+Rj+0plghcYUJJExk7KD1wOk7+JbewnqoSdbf1QvbO9EvemeeeisunrwIx0ONdXRKjBVfc4h1dwQjBE/5dnOH0amQqxGaLkf6XHwE0OCTv3S+2f3ERZe4HrFViOQCdE2z9auknF1ZXA3sjAfI/QJWIc1R0kp5OhORgonoUVRQYa/M8nQIDAQAB",
    // https://developer.chrome.com/docs/extensions/reference/api/sidePanel
    permissions: ['storage', 'tabs', 'sidePanel', 'identity'],
    // host_permissions: ["<all_urls>"],
    action: {}, // Required for sidepanel to open on action click
    commands: {
      "_execute_sidebar_action": {
        suggested_key: {
          default: "Ctrl+Shift+Space",
          mac: "Command+Shift+Space",
        },
        description: "Toggle the Bluesky Sidebar",
      },
    },
  },
  vite: () => ({
    plugins: [
      preact(),
      tailwindcss(),
      svgr(),
      injectOauthEnv(true)
    ] as PluginOption[],
  }),
  webExt: {
    chromiumArgs: ["--user-data-dir=./.wxt/chrome-data"],
    startUrls: [
      "https://ciechanow.ski/mechanical-watch/"
    ]
  }
});