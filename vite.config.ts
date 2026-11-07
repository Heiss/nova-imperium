import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  publicDir: 'src/client/static',
  build: {
    outDir: 'dist/public',
    target: 'es2022',
    sourcemap: true,
    rolldownOptions: {
      input: 'src/client/main.ts',
      output: { entryFileNames: 'app.js' },
    },
  },
});
