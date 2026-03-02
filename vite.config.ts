import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

function getPackageName(id: string) {
  const normalizedId = id.replace(/\\/g, '/');
  const modulePath = normalizedId.split('/node_modules/')[1];

  if (!modulePath) {
    return null;
  }

  const parts = modulePath.split('/');

  if (parts[0].startsWith('@')) {
    return `${parts[0]}/${parts[1]}`;
  }

  return parts[0];
}

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tsconfigPaths(),
  ],
  build: {
    target: 'esnext',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          const packageName = getPackageName(id);

          if (!packageName) {
            return 'vendor-misc';
          }

          if (
            packageName === '@mdxeditor/editor' ||
            packageName.startsWith('@lexical/') ||
            packageName === 'lexical' ||
            packageName.startsWith('@codemirror/') ||
            packageName === 'codemirror'
          ) {
            return 'vendor-editor';
          }

          if (packageName === 'react' || packageName === 'react-dom' || packageName === 'scheduler') {
            return 'vendor-react';
          }

          if (packageName === 'react-router-dom' || packageName === 'react-router') {
            return 'vendor-router';
          }

          if (
            packageName.startsWith('@radix-ui/') ||
            packageName === 'lucide-react' ||
            packageName === 'framer-motion' ||
            packageName === 'class-variance-authority' ||
            packageName === 'clsx' ||
            packageName === 'tailwind-merge'
          ) {
            return 'vendor-ui';
          }

          if (packageName.startsWith('@supabase/')) {
            return 'vendor-supabase';
          }

          if (
            packageName === 'react-markdown' ||
            packageName === 'remark-gfm' ||
            packageName.startsWith('remark-') ||
            packageName.startsWith('rehype-') ||
            packageName.startsWith('micromark') ||
            packageName.startsWith('mdast-') ||
            packageName.startsWith('hast-') ||
            packageName === 'unified'
          ) {
            return 'vendor-markdown';
          }

          return 'vendor-misc';
        },
      },
    },
  },
  publicDir: 'public',
  server: {
    host: true,
  },
});
