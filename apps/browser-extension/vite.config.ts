import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const polyfillShimRoot = path.resolve(__dirname, 'node_modules/vite-plugin-node-polyfills/shims')

export default defineConfig({
  base: './',
  plugins: [
    react(),
    nodePolyfills({
      include: [
        'buffer',
        'process',
        'events',
        'stream',
        'util',
        'string_decoder',
        'path',
      ],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@extension': path.resolve(__dirname, 'src'),
      '@': path.resolve(__dirname, '../next-app'),
      'vite-plugin-node-polyfills/shims/buffer': path.join(polyfillShimRoot, 'buffer'),
      'vite-plugin-node-polyfills/shims/process': path.join(polyfillShimRoot, 'process'),
      'vite-plugin-node-polyfills/shims/global': path.join(polyfillShimRoot, 'global'),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  define: {
    'process.env': {},
  },
})
