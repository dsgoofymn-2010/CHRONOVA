import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build:single` inlines everything into one HTML file (handy for previews).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    rollupOptions:
      mode === 'single'
        ? {}
        : { output: { manualChunks: { three: ['three'], motion: ['framer-motion', 'lenis'], react: ['react', 'react-dom'] } } },
  },
}));
