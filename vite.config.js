import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Base path for deployment
  base: './',
  publicDir: 'src/static',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        builder: resolve(__dirname, 'builder.html'),
      },
    },
    // Output directory
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost/firework/src/static',
        changeOrigin: true,
      },
      '/configs': {
        target: 'http://localhost/firework/src/static',
        changeOrigin: true,
      },
    },
  },
});
