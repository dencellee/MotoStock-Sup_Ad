import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      out: 'build',
      polyfill: true,
      precompress: false
    }),
    // HTTPS is enforced in production via environment
    // Development uses HTTP for simplicity
    csrf: {
      trustedOrigins: [
        'http://localhost',
        'http://127.0.0.1',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'file://',
        'app://-'
      ]
    }
  }
};

export default config;