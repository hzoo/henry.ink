import type { PluginOption } from "vite";
import metadata from "../henry-ink/public/oauth-client-metadata.json" with {
	type: "json",
};

export const SERVER_HOST = "127.0.0.1";
export const SERVER_PORT = 3003;

type Target = "web" | "chrome" | "firefox";

function redirectUri(suffix: string): string {
	const uri = metadata.redirect_uris.find((u) => u === suffix || u.endsWith(suffix));
	if (!uri) throw new Error(`oauth-client-metadata.json has no redirect URI ending in ${suffix}`);
	return uri;
}

/** Defines VITE_OAUTH_* from henry.ink's published OAuth client metadata. */
export function injectOauthEnv(target: Target = "web"): PluginOption {
	return {
		name: "inject-oauth-env",
		config: (_config, { command }) => {
			let clientId = metadata.client_id;
			let redirect =
				target === "firefox"
					? redirectUri("/extension/ff/oauth/callback")
					: target === "chrome"
						? redirectUri("/extension/oauth/callback")
						: redirectUri(metadata.client_uri);

			// The web dev server uses atproto's loopback client instead of the published one.
			if (target === "web" && command !== "build") {
				redirect = `http://${SERVER_HOST}:${SERVER_PORT}${new URL(redirect).pathname}`;
				clientId = `http://localhost?redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(metadata.scope)}`;
			}

			return {
				define: {
					"import.meta.env.VITE_OAUTH_CLIENT_ID": JSON.stringify(clientId),
					"import.meta.env.VITE_OAUTH_REDIRECT_URI": JSON.stringify(redirect),
					"import.meta.env.VITE_OAUTH_SCOPE": JSON.stringify(metadata.scope),
				},
			};
		},
	};
}

export function injectOauthEnvForExtension(browser: string): PluginOption {
	return injectOauthEnv(browser === "firefox" ? "firefox" : "chrome");
}
