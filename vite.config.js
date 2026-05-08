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
      output: {
        entryFileNames: 'assets/js/[name].js',
        chunkFileNames: 'assets/js/[name].js',
        assetFileNames: (assetInfo) => {
          let name = assetInfo.name;
          let originalFileName = assetInfo.originalFileName;
          
          // Determine the subfolder based on original path or extension
          let subDir = '';
          if (originalFileName && originalFileName.startsWith('src/assets/')) {
            const parts = originalFileName.split('/');
            // Get the folder under src/assets (e.g., 'img', 'audio', 'vendor')
            subDir = parts[2];
            // If it's scss, map it to css
            if (subDir === 'scss') subDir = 'css';
          }
          
          if (!subDir) {
            // Fallback to extension-based logic
            const ext = name.split('.').pop().toLowerCase();
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) subDir = 'img';
            else if (/woff|woff2|eot|ttf|otf/i.test(ext)) subDir = 'fonts';
            else if (/mp3|wav|ogg|m4a/i.test(ext)) subDir = 'audio';
            else if (/css/i.test(ext)) subDir = 'css';
            else subDir = 'misc';
          }

          // Special case: audio files under src/assets/audio/ — preserve subdir
          if (originalFileName && originalFileName.startsWith('src/assets/audio/')) {
            // e.g. src/assets/audio/lift/lift1.mp3 → assets/audio/lift/lift1.mp3
            const audioRel = originalFileName.replace('src/assets/audio/', '');
            return `assets/audio/${audioRel}`;
          }

          return `assets/${subDir}/[name][extname]`;

        },
      },
    },
    // Output directory
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    open: true,
    proxy: {
      '/static/api': {
        target: 'http://localhost/firework/src/static',
        changeOrigin: true,
      },
      '/static/configs': {
        target: 'http://localhost/firework/src/static',
        changeOrigin: true,
      },
    },
  },
});
