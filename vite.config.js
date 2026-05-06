import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Base path for deployment
  base: './',
  publicDir: 'src/assets/static',
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
  },
});
