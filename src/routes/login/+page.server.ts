import type { Actions } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import bcrypt from "bcryptjs";
import { db } from "$lib/server/db";
import { users, loginAuditLog } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

// Simple in-memory rate limiting (for demo/dev only)
// Replace with Redis or similar in production for distributed rate limiting
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function getClientIP(request: Request): string {
    // Try to get IP from X-Forwarded-For or remote address
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    // @ts-ignore: node specific
    return (request as any).ip || 'unknown';
}

function checkRateLimit(ip: string): boolean {
    // Always allow in dev; implement real logic in production
    return true;
}

export const actions: Actions = {
    default: async ({ request, cookies, getClientAddress }) => {
        // Only allow POST requests (prevent GET attacks)
        if (request.method !== 'POST') {
            return fail(405, { error: 'Method not allowed' });
        }

        // Get client IP
        const clientIP = getClientAddress() || getClientIP(request);
        console.log('[LOGIN] POST attempt from IP:', clientIP);

        // Rate limiting (no-op in dev)
        if (!checkRateLimit(clientIP)) {
            return fail(429, { error: "Too many login attempts. Try again later." });
        }

        const data = await request.formData();
        const username = data.get("username")?.toString().trim();
        const password = data.get("password")?.toString();
        console.log('[LOGIN] Submitted username:', username);

        if (!username || !password) {
            // Never reveal which field is missing (security best practice)
            return fail(400, { error: "Missing credentials" });
        }

        // Validate username format (prevent injection)
        if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
            return fail(400, { error: "Invalid username format" });
        }

        // Runtime checks (optional, can remove in production)
        if (!db) return fail(500, { error: 'Database not initialized' });
        if (!users) return fail(500, { error: 'User schema not loaded' });

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
            // Generic error message (don't reveal if user exists)
            console.warn('[LOGIN] No user found for username:', username);
            // Add delay to prevent username enumeration
            await new Promise(r => setTimeout(r, 200));
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
            // Add delay to prevent timing attacks
            await new Promise(r => setTimeout(r, 200));
            return fail(401, { error: "Invalid username or password" });
        }

        // ✅ PRODUCTION SECURITY: Only super_admin can login
        if (dbUser.role !== 'super_admin') {
            console.warn(`[LOGIN] Non-admin user attempted login: ${username} (role: ${dbUser.role}) from IP: ${clientIP}`);
            // Generic error message (security)
            await new Promise(r => setTimeout(r, 200));
            return fail(401, { error: "Invalid username or password" });
        }

        // Clear rate limit on successful login
        loginAttempts.delete(clientIP);

        const isProduction = process.env.NODE_ENV === 'production';

        // 📍 Log successful admin login with IP for monitoring
        console.log(`[LOGIN] ✅ Super admin login successful: ${username} from IP: ${clientIP}`);

        // 📊 Store login audit log for monitoring
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        try {
            await db.insert(loginAuditLog).values({
                userId: dbUser.id,
                username: dbUser.username,
                ipAddress: clientIP,
                userAgent: userAgent,
                status: 'success',
                loginTime: new Date()
            });
        } catch (auditErr) {
            console.error('[LOGIN] Failed to log audit entry:', auditErr);
            // Continue with login even if audit fails (don't block auth)
        }

        try {
            cookies.set(
                "session",
                JSON.stringify({ id: dbUser.id, role: dbUser.role, username: dbUser.username }),
                {
                    path: "/",
                    httpOnly: true,           // Prevent JavaScript from accessing the cookie
                    sameSite: "strict",       // Only send cookie to same site (CSRF protection)
                    secure: true,              // HTTPS only (always, even in dev)
                    maxAge: 60 * 60 * 24 * 7, // 7 days
                    domain: undefined          // Let browser use current domain
                }
            );
            
            // Clear password from memory (defense in depth)
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

