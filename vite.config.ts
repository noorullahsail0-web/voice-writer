import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import fs from 'fs';

// Helper to copy PDFjs worker from node_modules directly to Vite's local static public directory.
// This resolves the cross-origin CDN (CORS) restriction and "importScripts is not defined" Worker errors in prod/Vercel.
function copyPdfWorkerPlugin() {
  return {
    name: 'copy-pdf-worker',
    buildStart() {
      try {
        const srcPath = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
        const destDir = path.resolve(__dirname, 'public');
        
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, path.resolve(destDir, 'pdf.worker.min.mjs'));
          fs.copyFileSync(srcPath, path.resolve(destDir, 'pdf.worker.min.js'));
          console.log('[PDF.js Worker Copier] Successfully copied worker files to /public/');
        } else {
          console.warn('[PDF.js Worker Copier] Could not find worker at ' + srcPath);
        }
      } catch (err) {
        console.error('[PDF.js Worker Copier] Error copying worker:', err);
      }
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), copyPdfWorkerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
