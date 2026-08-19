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

function logDb(msg: string, ...args: unknown[]) {
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

  // Always log to stdout for web app access
  console.log(`[DB][${timestamp}]`, safeMsg, ...safeArgs);
}

// --- Environment Info ---
logDb('Running backend server entry');
logDb('NODE_ENV:', process.env.NODE_ENV);

// --- Load Environment ---
logDb('index.ts starting — loading environment...');
try {
  loadEnv();
  logDb('Environment loaded.');
} catch (e: unknown) {
  const error = e instanceof Error ? e.message : String(e);
  logDb('Error loading environment:', error);
  throw new Error(`Failed to load environment: ${error}`);
}

// --- Confirm DATABASE_URL reached this process ---
logDb('DATABASE_URL set:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
  logDb('DATABASE_URL preview:', process.env.DATABASE_URL.substring(0, 40) + '...');
} else {
  const msg = 'FATAL: DATABASE_URL is not set! .env file may be missing or DATABASE_URL not defined.';
  console.error('[DB]', msg);
  logDb(msg);
  throw new Error(msg);
}

// --- Postgres / Supabase Connection Config ---
const DB_CONFIG = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL in ALL environments
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // give more headroom in case the pooler is cold-starting
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
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[DB] Connection FAILED:', error);
    logDb('Supabase connection test failed:', error);
    throw new Error(`Database connection failed: ${error}`);
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
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      logDb(`Attempt ${attempt}/${retries} failed: ${error}`);
      if (attempt === retries) throw err;
      logDb(`Retrying in ${delayMs}ms...`);
      await new Promise(res => setTimeout(res, delayMs));
    }
  }
  throw new Error('withRetry: unreachable');
}

// --- Global DB Pool and Drizzle ---
// --- Global DB Pool and Drizzle (persisted across HMR reloads in dev) ---
const globalForDb = globalThis as unknown as {
  __pgPool?: Pool;
  __dbInitPromise?: Promise<void>;
  __dbInitialized?: boolean;
};

let pool: Pool = globalForDb.__pgPool!;
let db: ReturnType<typeof drizzle>;
let dbInitialized = globalForDb.__dbInitialized ?? false;
let dbInitPromise: Promise<void>;

if (globalForDb.__pgPool && globalForDb.__dbInitialized) {
  // Reuse the pool from a previous module load (dev HMR) instead of
  // creating a new one — prevents leaking connections on every reload.
  pool = globalForDb.__pgPool;
  db = drizzle(pool, { schema });
  dbInitialized = true;
  dbInitPromise = Promise.resolve();
  logDb('Reusing existing DB pool from previous module load (HMR).');
} else {
  dbInitPromise = (async () => {
    try {
      logDb('Starting database initialization...');
      await withRetry(() => initializeDatabase(), 3, 2000);
      logDb('Database initialization complete.');
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      console.error('[DB] FATAL: Database initialization failed after all retries.');
      console.error('[DB] Error:', error);
      logDb('initializeDatabase() failed.');
      throw e;
    }

    pool = new Pool(DB_CONFIG);
    logDb('Postgres connection pool created.');

    db = drizzle(pool, { schema });
    logDb('Drizzle ORM instance created.');

    dbInitialized = true;
    globalForDb.__pgPool = pool;
    globalForDb.__dbInitialized = true;
    logDb('DB fully ready ✅');
  })();
  globalForDb.__dbInitPromise = dbInitPromise;
}

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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logDb('Health check: FAILED ❌', msg);
    return false;
  }
}

logDb('index.ts module loaded — DB init running in background...');