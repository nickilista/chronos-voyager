import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: { passes: 3 },
    },
    assetsInlineLimit: 8192,
    cssCodeSplit: false,
    sourcemap: false,
  },
  server: {
    port: 5173,
    strictPort: false,
    host: true,
  },
});
