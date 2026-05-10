import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],

  server: {
    port: 5173,
    host: true
  },

  // ✅ This is the key fix — bundle server-side dependencies
  ssr: {
    // Only these stay external (pg has native bindings, can't be bundled)
    // Everything else including drizzle-orm gets bundled
    noExternal: [
      'drizzle-orm',
      '@supabase/supabase-js',
      'bcryptjs',
      'zod',
      'chart.js',
      'jsbarcode',
      'lru-cache',
      'dotenv',
      'electron-updater'
    ]
  },

  build: {
    rollupOptions: {
      external: [
        'pg',
        'pg-pool',
        'pg-protocol',
        'pg-types',
        'pgpass',
        'electron'
      ]
    }
  },

  optimizeDeps: {
    exclude: ['pg', 'pg-pool', 'pg-protocol', 'pg-types', 'pgpass']
  }
});