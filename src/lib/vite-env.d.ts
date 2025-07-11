/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
/// <reference types="@atcute/bluesky/lexicons" />

declare module '*.svg?react' {
    import type { ComponentType, JSX } from 'preact'
    const SVGComponent: ComponentType<JSX.SVGAttributes<SVGSVGElement>>
    export default SVGComponent
  }
  
// Augmentations for Vite environment variables used by OAuth
interface ImportMetaEnv {
	// readonly VITE_DEV_SERVER_PORT?: string;
	// readonly VITE_CLIENT_URI: string;
	readonly VITE_OAUTH_CLIENT_ID: string;
	readonly VITE_OAUTH_REDIRECT_URI: string;
	readonly VITE_OAUTH_SCOPE: string;
	readonly VITE_WORKER_URL: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare let browser: Browser;