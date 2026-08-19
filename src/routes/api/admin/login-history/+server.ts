import { json, error as httpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { loginAuditLog, users } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

// GET /api/admin/login-history
// Returns the last 20 successful super_admin logins for monitoring
export const GET: RequestHandler = async ({ locals }) => {
    try {
        // Only super_admin can access this endpoint
        if (!locals.user || locals.user.role !== 'super_admin') {
            return httpError(403, { message: 'Unauthorized: Super admin access required' });
        }

        // Get last 20 successful logins with user details
        const logins = await db
            .select({
                id: loginAuditLog.id,
                username: loginAuditLog.username,
                ipAddress: loginAuditLog.ipAddress,
                userAgent: loginAuditLog.userAgent,
                loginTime: loginAuditLog.loginTime,
                status: loginAuditLog.status
            })
            .from(loginAuditLog)
            .where(eq(loginAuditLog.status, 'success'))
            .orderBy(desc(loginAuditLog.loginTime))
            .limit(20);

        return json({
            success: true,
            count: logins.length,
            logins: logins.map(login => ({
                ...login,
                // Format date for display
                loginTimeFormatted: new Date(login.loginTime).toLocaleString(),
                // Extract browser/OS from user agent
                browserInfo: extractBrowserInfo(login.userAgent)
            }))
        });
    } catch (err) {
        console.error('[API] Login history error:', err);
        return httpError(500, { message: 'Failed to fetch login history' });
    }
};

/**
 * Simple browser/OS extraction from User-Agent
 * Format: "Chrome on Windows", "Safari on macOS", etc.
 */
function extractBrowserInfo(userAgent: string | null): string {
    if (!userAgent) return 'Unknown';

    // Extract major browser/OS patterns
    if (userAgent.includes('Chrome')) {
        const osMatch = userAgent.match(/Windows|Macintosh|Linux|Android|iPhone/);
        const os = osMatch ? osMatch[0].replace('Macintosh', 'macOS') : 'Unknown OS';
        return `Chrome on ${os}`;
    }
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        return 'Safari on macOS';
    }
    if (userAgent.includes('Firefox')) {
        const osMatch = userAgent.match(/Windows|X11|Macintosh/);
        const os = osMatch ? (osMatch[0] === 'X11' ? 'Linux' : osMatch[0] === 'Macintosh' ? 'macOS' : 'Windows') : 'Unknown OS';
        return `Firefox on ${os}`;
    }
    if (userAgent.includes('Edge')) {
        return 'Edge on Windows';
    }

    return userAgent.substring(0, 50); // Fallback
}
