import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import preact from "@preact/preset-vite";
import svgr from 'vite-plugin-svgr';
import metadata from './public/oauth/client-metadata.json' with { type: 'json' };

const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = 3003;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    svgr(),
    {
      name: 'inject-oauth-env',
      config: (_config, { command }) => {
        let define = {};
        if (command === 'build') {
          define = {
            'import.meta.env.VITE_OAUTH_CLIENT_ID': JSON.stringify(metadata.client_id),
            'import.meta.env.VITE_OAUTH_REDIRECT_URI': JSON.stringify(metadata.redirect_uris[0]),
            'import.meta.env.VITE_OAUTH_SCOPE': JSON.stringify(metadata.scope),
          };
        } else {
          const redirectUri = (() => {
            const url = new URL(metadata.redirect_uris[0]);
            return `http://${SERVER_HOST}:${SERVER_PORT}${url.pathname}`;
          })();
          const clientId = `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(metadata.scope)}`;

          define = {
            'import.meta.env.VITE_OAUTH_CLIENT_ID': JSON.stringify(clientId),
            'import.meta.env.VITE_OAUTH_REDIRECT_URI': JSON.stringify(redirectUri),
            'import.meta.env.VITE_OAUTH_SCOPE': JSON.stringify(metadata.scope),
          };
        }
        return { define };
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  server: {
    host: SERVER_HOST,
    port: SERVER_PORT,
  },
}); 