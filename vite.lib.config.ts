import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import preact from "@preact/preset-vite";
import svgr from 'vite-plugin-svgr';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/guide/build.html#library-mode
export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(), // Ensure Tailwind processes classes used in the component
    svgr({
      // svgr options can be specified here if needed
    }),
    dts({ // Generate .d.ts files
      insertTypesEntry: true, // Create a single entry point for types
      include: ['components/post/FullPost.tsx', 'lib/vite-env.d.ts'], // Include components and lib types
      // You might need to adjust 'include' if utility functions or other components need explicit type exports
    }),
  ],
  resolve: {
    alias: {
      // Keep the alias consistent with your main config
      '@': path.resolve(__dirname, './'),
    },
  },
  build: {
    outDir: 'dist-npm', // Output directory for the npm package contents
    cssCodeSplit: false, // Bundle all CSS into a single file (simpler for consumers)
    sourcemap: false, // Generate sourcemaps for easier debugging
    lib: {
      entry: path.resolve(__dirname, 'components/post/FullPost.tsx'),
      formats: ['es'],
      fileName: (format) => `bluesky-full-post.${format}.js`,
    },
    rollupOptions: {
      // Ensure peer dependencies are not bundled
      external: [
        'preact',
        'preact/hooks',
        '@preact/signals',
        '@preact/signals-react/runtime', // Might be needed depending on exact signal usage in dependencies
        '@atcute/client',
        '@atcute/client/lexicons',
        '@atcute/bluesky', // Add any other @atcute or external libs used indirectly
        '@atcute/bluesky-richtext-segmenter'
      ]
    },
  },
}); 