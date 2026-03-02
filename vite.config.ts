import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tsconfigPaths(),
  ],
  build: {
    target: 'esnext',
    minify: 'esbuild',
  },
  publicDir: 'public',
  server: {
    host: true,
  },
});
