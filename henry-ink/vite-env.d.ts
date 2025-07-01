/// <reference types="vite/client" />

// Augmentations for Vite environment variables used by OAuth
interface ImportMetaEnv {
	// readonly VITE_DEV_SERVER_PORT?: string;
	// readonly VITE_CLIENT_URI: string;
	readonly VITE_OAUTH_CLIENT_ID: string;
	readonly VITE_OAUTH_REDIRECT_URI: string;
	readonly VITE_OAUTH_SCOPE: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
} 