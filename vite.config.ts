import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import preact from "@preact/preset-vite";
import svgr from 'vite-plugin-svgr';
const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = 3003;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    svgr(),
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