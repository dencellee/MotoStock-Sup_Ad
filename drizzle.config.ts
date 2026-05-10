/** @type {import('drizzle-kit').Config} */
function getDatabaseUrl() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    return process.env.DATABASE_URL;
  }

  throw new Error('Missing DATABASE_URL for Supabase (PostgreSQL).');
}

export default {
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: getDatabaseUrl()
  }
};