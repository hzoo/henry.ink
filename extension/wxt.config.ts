import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import preact from "@preact/preset-vite";
import svgr from "vite-plugin-svgr";
import { version } from "./package.json";
import { injectOauthEnvForExtension } from "../scripts/inject-oauth-plugin";
import { resolve } from "node:path";

// See https://wxt.dev/api/config.html
export default defineConfig({
	alias: {
		"@": resolve(__dirname, "..")
	},
	entrypointsDir: "./entrypoints",
	manifest: (env) => ({
		name: "Bluesky Sidebar",
		description: "See what people are saying about the site you're on",
		version: version,
		...(env.browser === "chrome" && {
			key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0HvtHayny9zfPXB1QgdZVfPggiLY5RXxD0IKtquHr9X/iWQ+I0YNVWgPGjXZgKSAkzMQpudpbgxZCsx7vqPLLXwEzJ9dn8+vy2AIijokcOeDYlsA44XL0BiSyAeAmFOet1yiD/nvdtGqBbVHTliOZ5PL9Ud9g3WTwA4R8x+Rj+0plghcYUJJExk7KD1wOk7+JbewnqoSdbf1QvbO9EvemeeeisunrwIx0ONdXRKjBVfc4h1dwQjBE/5dnOH0amQqxGaLkf6XHwE0OCTv3S+2f3ERZe4HrFViOQCdE2z9auknF1ZXA3sjAfI/QJWIc1R0kp5OhORgonoUVRQYa/M8nQIDAQAB",
		}),
		permissions: [
			"storage",
			"tabs",
			// https://developer.chrome.com/docs/extensions/reference/api/sidePanel
			...(env.browser === "chrome" ? ["sidePanel"] : []),
			"identity",
			"contextMenus",
			// Add host permissions for Firefox MV2 (in permissions array)
			...(env.browser === "firefox" ? ["<all_urls>"] : []),
		],
		action: {}, // Required for sidepanel to open on action click
		commands: {
			_execute_sidebar_action: {
				suggested_key: {
					default: "Ctrl+Shift+Space",
					mac: "Command+Shift+Space",
				},
				description: "Toggle the Bluesky Sidebar",
			},
		},
		browser_specific_settings: {
			gecko: {
				id: "{42f52678-fbed-4a73-88dd-b01f94d06cdb}",
			},
		},
	}),
	vite: (env) => ({
		plugins: [
			preact(),
			tailwindcss(),
			svgr(),
			injectOauthEnvForExtension(env.browser),
		]
	}),
	webExt: {
		chromiumArgs: ["--user-data-dir=./.wxt/chrome-data"],
		startUrls: ["https://ciechanow.ski/mechanical-watch/"],
	},
});