import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

/**
 * Migration: Add login_audit_log table for tracking super_admin login locations
 * 
 * This table tracks:
 * - When super_admin users log in
 * - Which IP address they logged in from
 * - What browser/OS they used
 * - Success/failure status
 * 
 * Usage: Run this migration when deploying the security update
 */
export async function migrate() {
    console.log('🔄 Running migration: Create login_audit_log table...');
    
    try {
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS login_audit_log (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                username VARCHAR(50) NOT NULL,
                ip_address VARCHAR(45) NOT NULL,
                user_agent TEXT,
                status VARCHAR(20) NOT NULL DEFAULT 'success',
                reason VARCHAR(100),
                login_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
        `);

        // Create indexes for performance
        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS login_audit_user_idx ON login_audit_log(user_id);
        `);
        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS login_audit_ip_idx ON login_audit_log(ip_address);
        `);
        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS login_audit_time_idx ON login_audit_log(login_time);
        `);
        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS login_audit_status_idx ON login_audit_log(status);
        `);

        console.log('✅ Migration complete: login_audit_log table created with indexes');
        return true;
    } catch (err) {
        console.error('❌ Migration failed:', err);
        throw err;
    }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    migrate().then(() => process.exit(0)).catch(err => {
        console.error(err);
        process.exit(1);
    });
}
