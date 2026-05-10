import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { sql } from 'drizzle-orm'; // Import the SQL tag

export const GET: RequestHandler = async () => {
    try {
        // Use the sql tag for a truly universal health check
        await db.execute(sql`SELECT 1`);

        return json({
            status: 'ok',
            message: 'Database connection successful'
        }, { status: 200 });

    } catch (error) {
        console.error('Database connection failed:', error);
        
        return json({
            status: 'error',
            message: 'Database connection failed',
            details: error instanceof Error ? error.message : 'Unknown database error'
        }, { status: 500 });
    }
};