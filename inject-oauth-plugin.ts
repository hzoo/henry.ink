import type { UserConfig, PluginOption } from "vite";
import defaultMetadata from "./public/oauth/client-metadata.json" with {
	type: "json",
};
import henryInkMetadata from "./note-site/public/oauth/client-metadata.json" with {
	type: "json",
};

export const SERVER_HOST = "127.0.0.1";
export const SERVER_PORT = 3003;

type OAuthConfig = {
	client_id: string;
	client_uri: string;
	redirect_uris: string[];
	scope: string;
};

// Build target configurations - easy to add new targets here
const TARGET_CONFIGS = {
	"annotation-demo": defaultMetadata,
	"henry.ink": henryInkMetadata,
	"extension-chrome": defaultMetadata,
	"extension-firefox": defaultMetadata,
} as const;

type BuildTarget = keyof typeof TARGET_CONFIGS;

function getOAuthConfig(target: BuildTarget): OAuthConfig {
	const config = TARGET_CONFIGS[target];
	if (!config) {
		throw new Error(
			`Unknown build target: ${target}. Available targets: ${Object.keys(TARGET_CONFIGS).join(", ")}`,
		);
	}
	return config;
}

function validateAndGetUris(metadata: OAuthConfig) {
	const WEB_PROD_REDIRECT_URI = metadata.redirect_uris.find(
		(uri) => uri === metadata.client_uri,
	);
	const EXT_CALLBACK_REDIRECT_URI = metadata.redirect_uris.find((uri) =>
		uri.endsWith("/oauth/callback"),
	);
	const FF_EXT_CALLBACK_REDIRECT_URI = metadata.redirect_uris.find((uri) =>
		uri.endsWith("/ff/oauth/callback"),
	);

	if (!WEB_PROD_REDIRECT_URI) {
		throw new Error(
			`Could not find the main web redirect URI (matching client_uri) in OAuth config for ${metadata.client_uri}`,
		);
	}
	if (!EXT_CALLBACK_REDIRECT_URI) {
		throw new Error(
			`Could not find the extension callback redirect URI (.../oauth/callback) in OAuth config for ${metadata.client_uri}`,
		);
	}
	if (!FF_EXT_CALLBACK_REDIRECT_URI) {
		throw new Error(
			`Could not find the Firefox extension callback redirect URI (.../ff/oauth/callback) in OAuth config for ${metadata.client_uri}`,
		);
	}

	return {
		WEB_PROD_REDIRECT_URI,
		EXT_CALLBACK_REDIRECT_URI,
		FF_EXT_CALLBACK_REDIRECT_URI,
	};
}

// Helper function for extensions
export function injectOauthEnvForExtension(browser: string): PluginOption {
	const target: BuildTarget =
		browser === "firefox" ? "extension-firefox" : "extension-chrome";
	return injectOauthEnv(target);
}

export function injectOauthEnv(
	target: BuildTarget = "annotation-demo",
): PluginOption {
	return {
		name: "inject-oauth-env",
		config: (_config: UserConfig, { command }: { command: string }) => {
			const metadata = getOAuthConfig(target);
			const {
				WEB_PROD_REDIRECT_URI,
				EXT_CALLBACK_REDIRECT_URI,
				FF_EXT_CALLBACK_REDIRECT_URI,
			} = validateAndGetUris(metadata);

			let define = {};
			let clientId = metadata.client_id;
			let redirectUri: string;

			if (target.startsWith("extension-")) {
				if (target === "extension-firefox") {
					redirectUri = FF_EXT_CALLBACK_REDIRECT_URI;
				} else {
					redirectUri = EXT_CALLBACK_REDIRECT_URI;
				}
			} else {
				if (command === "build") {
					redirectUri = WEB_PROD_REDIRECT_URI;
				} else {
					// Web dev uses derived local redirect URI based on the production web URI's path
					const webDevPath = new URL(WEB_PROD_REDIRECT_URI).pathname;
					redirectUri = `http://${SERVER_HOST}:${SERVER_PORT}${webDevPath}`;
					// Construct local dev client ID only for web dev
					clientId = `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(metadata.scope)}`;
				}
			}

			define = {
				"import.meta.env.VITE_OAUTH_CLIENT_ID": JSON.stringify(clientId),
				"import.meta.env.VITE_OAUTH_REDIRECT_URI": JSON.stringify(redirectUri),
				"import.meta.env.VITE_OAUTH_SCOPE": JSON.stringify(metadata.scope),
			};

			// For extensions, also pass through VITE_WORKER_URL and VITE_EXTENSION_APP_PASSWORD from process.env
			// if (target.startsWith('extension-')) {
			//   if (process.env.VITE_WORKER_URL) {
			//     define['import.meta.env.VITE_WORKER_URL'] = JSON.stringify(process.env.VITE_WORKER_URL);
			//   }
			//   if (process.env.VITE_EXTENSION_APP_PASSWORD) {
			//     define['import.meta.env.VITE_EXTENSION_APP_PASSWORD'] = JSON.stringify(process.env.VITE_EXTENSION_APP_PASSWORD);
			//   }
			// }

			return { define };
		},
	} as PluginOption;
}
