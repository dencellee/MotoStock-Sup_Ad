import adapterNode from '@sveltejs/adapter-node';
import adapterVercel from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Vercel sets process.env.VERCEL=1 automatically during its own builds.
// Locally / when building the Electron bundle, that var is unset, so this
// falls back to adapter-node — same as before, nothing changes for the
// desktop app or your PC deployment.
const adapter = process.env.VERCEL
  ? adapterVercel()
  : adapterNode({
      out: 'build',
      polyfill: true,
      precompress: false
    });

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter,
    alias: {
      $lib: 'src/lib'
    },
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
        'app://-',

        // TODO: replace with your actual Vercel production domain once
        // it's assigned (Project Settings -> Domains). SvelteKit's
        // trustedOrigins doesn't support wildcards, so *.vercel.app
        // preview URLs won't be trusted automatically — if you need
        // form actions to work on preview deploys too, either add each
        // preview URL here as it's created, or set a fixed custom
        // domain in Vercel and only trust that.
        'https://your-app.vercel.app'
      ]
    }
  }
};

export default config;