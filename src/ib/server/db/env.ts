import fs from 'fs';
import path from 'path';

export function loadEnv() {
  // In packaged Electron app, process.cwd() may not point to resources
  // So we try multiple possible locations for .env
  const possibleDirs = [
    process.cwd(),
    path.dirname(process.argv[1] || ''),  // next to the running script
    process.env.RESOURCE_PATH || '',       // custom env var if set
  ].filter(Boolean);

  const envFiles = ['.env'];

  for (const dir of possibleDirs) {
    for (const filename of envFiles) {
      const envPath = path.join(dir as string, filename);

      if (!fs.existsSync(envPath)) continue;

      try {
        const content = fs.readFileSync(envPath, 'utf-8');

        content.split('\n').forEach(line => {
          const trimmed = line.trim();

          // Skip empty lines and comments
          if (!trimmed || trimmed.startsWith('#')) return;

          // Split ONLY on the FIRST = sign
          // Critical for Supabase URLs which contain = inside them
          const eqIndex = trimmed.indexOf('=');
          if (eqIndex === -1) return;

          const key = trimmed.substring(0, eqIndex).trim();
          let val   = trimmed.substring(eqIndex + 1).trim();

          if (!key) return;

          // Strip surrounding quotes if present
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }

          // Don't override already-set env vars
          // (allows main.cjs to pass DATABASE_URL via spawn env)
          if (process.env[key]) return;

          process.env[key] = val;
        });

        console.log(`[env] Loaded: ${envPath}`);
        return; // Stop after first successful .env load

      } catch (e: any) {
        console.error(`[env] Failed to read ${envPath}:`, e.message);
      }
    }
  }

  console.warn('[env] No .env file found in any of:', possibleDirs);
}