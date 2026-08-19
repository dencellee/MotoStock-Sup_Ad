import type { Actions } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import bcrypt from "bcryptjs";
import { db } from "$lib/server/db";
import { users, loginAuditLog } from "$lib/server/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

const MAX_ATTEMPTS = 10;
const LOCKOUT_WINDOW_MINUTES = 15;

function getClientIP(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    // @ts-ignore: node specific
    return (request as any).ip || 'unknown';
}

/**
 * DB-backed lockout check using the existing loginAuditLog table.
 * Counts recent 'failed' attempts for this username within the window.
 */
async function checkLoginLockout(username: string): Promise<{ locked: boolean; retryAfterSeconds?: number }> {
    const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000);

    try {
        const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(loginAuditLog)
            .where(
                and(
                    eq(loginAuditLog.username, username),
                    eq(loginAuditLog.status, 'failed'),
                    gte(loginAuditLog.loginTime, windowStart)
                )
            );

        const failureCount = Number(result[0]?.count ?? 0);
        if (failureCount >= MAX_ATTEMPTS) {
            return { locked: true, retryAfterSeconds: LOCKOUT_WINDOW_MINUTES * 60 };
        }
        return { locked: false };
    } catch (err) {
        console.error('[LOGIN] Lockout check failed, failing open:', err);
        return { locked: false };
    }
}

async function recordLoginAttempt(opts: {
    userId: number;
    username: string;
    ipAddress: string;
    userAgent: string;
    status: 'success' | 'failed';
}) {
    try {
        await db.insert(loginAuditLog).values({
            userId: opts.userId,
            username: opts.username,
            ipAddress: opts.ipAddress,
            userAgent: opts.userAgent,
            status: opts.status,
            loginTime: new Date()
        });
    } catch (auditErr) {
        console.error('[LOGIN] Failed to log audit entry:', auditErr);
    }
}

export const actions: Actions = {
    default: async ({ request, cookies, getClientAddress }) => {
        if (request.method !== 'POST') {
            return fail(405, { error: 'Method not allowed' });
        }

        const clientIP = getClientAddress() || getClientIP(request);
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        console.log('[LOGIN] POST attempt from IP:', clientIP);

        const data = await request.formData();
        const username = data.get("username")?.toString().trim();
        const password = data.get("password")?.toString();
        console.log('[LOGIN] Submitted username:', username);

        if (!username || !password) {
            return fail(400, { error: "Missing credentials" });
        }

        if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
            return fail(400, { error: "Invalid username format" });
        }

        if (!db) return fail(500, { error: 'Database not initialized' });
        if (!users) return fail(500, { error: 'User schema not loaded' });

        // 🔒 Brute-force lockout check — BEFORE touching the password at all
        const lockout = await checkLoginLockout(username);
        if (lockout.locked) {
            console.warn(`[LOGIN] Locked out: ${username} from IP: ${clientIP}`);
            return fail(429, {
                error: `Too many failed attempts. Try again in ${Math.ceil((lockout.retryAfterSeconds ?? 900) / 60)} minutes.`
            });
        }

        let userResult;
        try {
            userResult = await db
                .select()
                .from(users)
                .where(eq(users.username, username))
                .limit(1);
        } catch (err) {
            return fail(500, { error: 'Database query failed' });
        }

        if (userResult.length === 0) {
            console.warn('[LOGIN] No user found for username:', username);
           await recordLoginAttempt({ userId: 0, username, ipAddress: clientIP, userAgent, status: 'failed' });
            await new Promise(r => setTimeout(r, 400));
            return fail(401, { error: "Invalid username or password" });
        }

        const dbUser = userResult[0];
        let valid = false;
        try {
            valid = await bcrypt.compare(password, dbUser.passwordHash || "");
        } catch (err) {
            // bcrypt error
        }

        if (!valid) {
            console.warn('[LOGIN] Invalid password for user:', username);
            await recordLoginAttempt({ userId: dbUser.id, username, ipAddress: clientIP, userAgent, status: 'failed' });
            await new Promise(r => setTimeout(r, 400));
            return fail(401, { error: "Invalid username or password" });
        }

        if (dbUser.role !== 'super_admin') {
            console.warn(`[LOGIN] Non-admin user attempted login: ${username} (role: ${dbUser.role}) from IP: ${clientIP}`);
            await recordLoginAttempt({ userId: dbUser.id, username, ipAddress: clientIP, userAgent, status: 'failed' });
            await new Promise(r => setTimeout(r, 400));
            return fail(401, { error: "Invalid username or password" });
        }

        const isProduction = process.env.NODE_ENV === 'production';

        console.log(`[LOGIN] ✅ Super admin login successful: ${username} from IP: ${clientIP}`);

        // Also resets lockout, since we only count 'failed' rows in the window
        await recordLoginAttempt({ userId: dbUser.id, username, ipAddress: clientIP, userAgent, status: 'success' });

        try {
            cookies.set(
                "session",
                JSON.stringify({ id: dbUser.id, role: dbUser.role, username: dbUser.username }),
                {
                    path: "/",
                    httpOnly: true,
                    sameSite: "strict",
                    secure: isProduction,
                    maxAge: 60 * 60 * 24 * 7,
                    domain: undefined
                }
            );
            Object.assign(dbUser, { passwordHash: undefined });
        } catch (err) {
            return fail(500, { error: 'Failed to set session cookie' });
        }

        if (dbUser.role === "super_admin") {
            throw redirect(303, "/super_admin/dashboard");
        } else if (dbUser.role === "admin") {
            throw redirect(303, "/admin/products");
        } else {
            throw redirect(303, "/staff/pos");
        }
    }
};