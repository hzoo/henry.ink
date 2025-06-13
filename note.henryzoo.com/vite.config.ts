import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import preact from "@preact/preset-vite";
import svgr from "vite-plugin-svgr";
import { SERVER_PORT } from "../inject-oauth-plugin";

// https://vitejs.dev/config/
export default defineConfig({
	root: "note.henryzoo.com",
	plugins: [preact(), tailwindcss(), svgr()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "../"),
		},
	},
	build: {
		outDir: "dist",
	},
	server: {
		port: SERVER_PORT,
	},
});
