import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import preact from "@preact/preset-vite";
import svgr from 'vite-plugin-svgr';
import { injectOauthEnv, SERVER_HOST, SERVER_PORT } from './inject-oauth-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    svgr(),
    injectOauthEnv(false)
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