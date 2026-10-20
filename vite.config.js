/*!
 * Trình diễn Pháo hoa – cấu hình build
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

import { defineConfig } from 'vite';
import fs from 'fs';
import { resolve } from 'path';
import seoPlugin from './seo-plugin.js';

// Kèm giấy phép và danh sách thành phần bên thứ ba trong bản build
// (giấy phép MIT của lõi mô phỏng gốc yêu cầu giữ thông báo bản quyền trong mọi bản phân phối)
// Thông báo bản quyền ở đầu mỗi file JS đã build (Rollup thêm banner sau bước nén nên không bị lược bỏ).
const jsBanner = (chunk) => {
  const lines = [
    '/*! Trình diễn Pháo hoa | © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu, xem LICENSE.txt',
    ' * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép. Liên hệ: vuhoainam18032002@gmail.com',
  ];
  return lines.join('\n') + ' */';
};

const legalFilesPlugin = () => ({
  name: 'firework-legal-files',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'LICENSE.txt', source: fs.readFileSync(resolve(__dirname, 'LICENSE'), 'utf8') });
    this.emitFile({ type: 'asset', fileName: 'THIRD_PARTY_NOTICES.md', source: fs.readFileSync(resolve(__dirname, 'THIRD_PARTY_NOTICES.md'), 'utf8') });
  }
});

export default defineConfig({
  // Base path for deployment
  base: './',
  publicDir: 'src/static',
  // Trang chia sẻ s/<tên>.html (ảnh + tiêu đề khi gửi link), sitemap.xml, robots.txt
  plugins: [seoPlugin({ configsDir: resolve(__dirname, 'src/static/configs') }), legalFilesPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        builder: resolve(__dirname, 'builder.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
        // Trang theo dõi mở quà của người gửi (theo-doi.html?id=...&key=...)
        track: resolve(__dirname, 'theo-doi.html'),
      },
      output: {
        // Có mã hash trong tên file JS/CSS: mỗi lần deploy trình duyệt tải ngay bản mới,
        // không dùng bản cũ trong cache (GitHub Pages cho phép cache 10 phút) chạy với HTML mới.
        banner: jsBanner,
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
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

          if (subDir === 'css') return 'assets/css/[name]-[hash][extname]';
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
    // Chỉ API PHP cần chuyển qua Apache (XAMPP); configs/ và uploads/ được Vite phục vụ trực tiếp từ publicDir (src/static)
    proxy: {
      '/api': {
        target: 'http://localhost/firework/src/static',
        changeOrigin: true,
      },
      // Trang chia sẻ: .htaccess của Apache chuyển s/<tên>.html sang api/share.php
      '/s/': {
        target: 'http://localhost/firework/src/static',
        changeOrigin: true,
      },
    },
  },
});
