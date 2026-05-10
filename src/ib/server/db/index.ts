// --- Imports ---
import fs from 'fs';
import path from 'path';
import { loadEnv } from './env';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// --- Debugging Utilities ---
const logDir  = path.join(process.cwd(), 'logs');
const logFile = path.join(logDir, 'db_debug.log');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

function logDb(msg: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  let safeMsg = msg;

  if (typeof safeMsg === 'string') {
    safeMsg = safeMsg.replace(/database ['"]?([\w-]+)['"]?/gi, 'database [REDACTED]');
    safeMsg = safeMsg.replace(/error: ([^\n]+)/gi, 'error: [REDACTED]');
    safeMsg = safeMsg.replace(/postgresql:\/\/[^\s]+/gi, 'postgresql://[REDACTED]');
  }

  const safeArgs = args.map(a =>
    typeof a === 'string'
      ? a
          .replace(/database ['"]?([\w-]+)['"]?/gi, 'database [REDACTED]')
          .replace(/error: ([^\n]+)/gi, 'error: [REDACTED]')
          .replace(/postgresql:\/\/[^\s]+/gi, 'postgresql://[REDACTED]')
      : a
  );

  const fullMsg =
    `[DB][${timestamp}] ${safeMsg}` +
    safeArgs.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ') +
    '\n';

  fs.appendFileSync(logFile, fullMsg);

  // Always log to stdout so Electron captures it in server.stdout
  console.log(`[DB][${timestamp}]`, safeMsg, ...safeArgs);
}

// --- Electron Context Check ---
const isElectron    = !!process.versions.electron;
const isMainProcess =
  isElectron &&
  typeof (process as any).type === 'string' &&
  (process as any).type === 'browser';

logDb('Running backend server entry');
logDb('NODE_ENV:', process.env.NODE_ENV);
logDb('isElectron:', isElectron);
logDb('isMainProcess:', isMainProcess);

if (isMainProcess) {
  logDb('Skipping backend logic in Electron main process');
  process.exit(0);
}

// --- Load Environment ---
logDb('index.ts starting — loading environment...');
try {
  loadEnv();
  logDb('Environment loaded.');
} catch (e: any) {
  logDb('Error loading environment:', e?.message);
}

// --- Confirm DATABASE_URL reached this process ---
logDb('DATABASE_URL set:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
  logDb('DATABASE_URL preview:', process.env.DATABASE_URL.substring(0, 40) + '...');
} else {
  console.error('[DB] FATAL: DATABASE_URL is not set!');
  console.error('[DB] .env file may be missing or DATABASE_URL not defined inside it.');
  process.exit(1);
}

// --- Postgres / Supabase Connection Config ---
const DB_CONFIG = {
  connectionString: process.env.DATABASE_URL,
  // ✅ Required for Supabase — uses self-signed cert in production
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// Log connection info (safely — never log full URL with password)
try {
  const url = new URL(process.env.DATABASE_URL!);
  logDb('Connecting to host:', url.host);
  logDb('Database:', url.pathname.replace(/^\//, ''));
  logDb('User:', url.username);
} catch (e) {
  logDb('Could not parse DATABASE_URL for logging.');
}

// --- Database Initialization ---
async function initializeDatabase(): Promise<void> {
  logDb('Verifying Supabase connection...');
  const testPool = new Pool(DB_CONFIG);
  try {
    await testPool.query('SELECT 1');
    logDb('Supabase connection verified ✅');
  } catch (err: any) {
    // Print full error to stderr so Electron crash dialog captures it
    console.error('[DB] Connection FAILED:', err.message);
    console.error('[DB] Full error:', err);
    logDb('Supabase connection test failed:', err.message);
    throw err;
  } finally {
    await testPool.end();
  }
}

// --- Retry Logic ---
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 2000
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      logDb(`Attempt ${attempt}/${retries} failed: ${err?.message}`);
      if (attempt === retries) throw err;
      logDb(`Retrying in ${delayMs}ms...`);
      await new Promise(res => setTimeout(res, delayMs));
    }
  }
  throw new Error('withRetry: unreachable');
}

// --- Global DB Pool and Drizzle ---
let pool: Pool;
let db: ReturnType<typeof drizzle>;
let dbInitialized  = false;
let dbInitPromise: Promise<void>;

// Initialize immediately on import
dbInitPromise = (async () => {
  try {
    logDb('Starting database initialization...');
    await withRetry(() => initializeDatabase(), 3, 2000);
    logDb('Database initialization complete.');
  } catch (e: any) {
    // ✅ Full error to stderr — Electron crash dialog will show this
    console.error('[DB] FATAL: Database initialization failed after all retries.');
    console.error('[DB] Error:', e?.message);
    console.error('[DB] Stack:', e?.stack);
    logDb('initializeDatabase() failed. Exiting.');
    process.exit(1);
  }

  pool = new Pool(DB_CONFIG);
  logDb('Postgres connection pool created.');

  db = drizzle(pool, { schema });
  logDb('Drizzle ORM instance created.');

  dbInitialized = true;
  logDb('DB fully ready ✅');
})();

// --- Export: Wait for DB ---
export async function waitForDb() {
  if (!dbInitialized) {
    await dbInitPromise;
  }
  return { db, pool };
}

// --- Safe Getters ---
export function getDb() {
  if (!dbInitialized) throw new Error('DB not ready. Use waitForDb() first.');
  return db;
}

export function getPool() {
  if (!dbInitialized) throw new Error('Pool not ready. Use waitForDb() first.');
  return pool;
}

export { db, pool };

// --- Connection Health Check ---
export async function checkDbConnection(): Promise<boolean> {
  try {
    if (!pool) throw new Error('Pool not initialized');
    await pool.query('SELECT 1');
    logDb('Health check: OK ✅');
    return true;
  } catch (error: any) {
    logDb('Health check: FAILED ❌', error.message);
    return false;
  }
}

logDb('index.ts module loaded — DB init running in background...');