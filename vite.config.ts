import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      // dev server (port 5173) is exposed on host:true already — this lets
      // the plugin also run in dev so you can test the install prompt
      // without a full production build.
      devOptions: {
        enabled: true,
        type: 'module'
      },
      manifest: {
        name: 'MotoStock',
        short_name: 'MotoStock',
        description: 'MotoStock inventory & sales management',
        start_url: '/super_admin/sales',
        scope: '/',
        display: 'standalone',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Don't precache/cache API or data routes — this is a live sales
        // dashboard, the boss should always see fresh numbers, not a
        // stale offline snapshot.
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ],

  server: {
    port: 5173,
    host: true
  },

  // ✅ This is the key fix — bundle server-side dependencies
  ssr: {
    // Keep CommonJS modules external (they can't be bundled as ESM)
    external: [
      'bcryptjs',
      'pg',
      'pg-pool',
      'pg-protocol',
      'pg-types',
      'pgpass'
    ],
    // Bundle ESM-compatible dependencies
    noExternal: [
      'drizzle-orm',
      '@supabase/supabase-js',
      'zod',
      'chart.js',
      'jsbarcode',
      'lru-cache',
      'dotenv'
    ]
  },

  optimizeDeps: {
    exclude: ['pg', 'pg-pool', 'pg-protocol', 'pg-types', 'pgpass', 'bcryptjs']
  }
});