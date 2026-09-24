import {defineConfig} from 'vite';

export default defineConfig({
  root: 'console',
  base: '/',
  server: {
    host: '127.0.0.1', port: 8300, strictPort: true,
    proxy: {'/api': {target: 'http://127.0.0.1:8301', changeOrigin: false}},
  },
  build: {outDir: '../dist', emptyOutDir: true},
});
