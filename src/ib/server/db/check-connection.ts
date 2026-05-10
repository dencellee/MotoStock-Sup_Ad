

import { checkDbConnection } from "./index";

export async function checkDbConnectionAsync(): Promise<boolean> {
  try {
    const ok = await checkDbConnection();
    if (ok) {
      console.log("✅ Postgres (Supabase) database connection verified");
      return true;
    } else {
      console.error("❌ Postgres database connection failed: Invalid response");
      return false;
    }
  } catch (error: any) {
    console.error("❌ Postgres database connection check failed:", error.message);
    return false;
  }
}

// Optional: run when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkDbConnectionAsync().then((ok) => process.exit(ok ? 0 : 1));
}
