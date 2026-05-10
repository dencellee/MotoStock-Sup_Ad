
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { createReadStream, existsSync } from 'fs';
import { Readable } from 'stream';
import { resolve as pathResolve } from 'path';
import { waitForDb } from '$lib/server/db';


// // Track up to 3 unique client IPs
// const allowedClientIPs = new Set<string>();

// Ensure database is initialized before handling requests
let dbReady = false;
const dbReadyPromise = waitForDb().then(() => {
    dbReady = true;
    console.log('[hooks.server] Database ready');
}).catch(err => {
    console.error('[hooks.server] Database initialization failed:', err);
    process.exit(1);
});


export const handle: Handle = async ({ event, resolve }) => {
    if (!dbReady) {
        await dbReadyPromise;
    }

    const { pathname } = event.url;
    // Log only in development
    if (process.env.NODE_ENV !== 'production') {

        console.log('[hooks.server] Request:', {
            origin: event.request.headers.get('origin'),
            pathname,
            method: event.request.method
        });
    }

    // Serve /health endpoint for health checks
    if (pathname === '/health') {
        return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    // Parse session cookie (synchronous)
    let sessionCookie = event.cookies.get('session');
    if (sessionCookie) {
        try {
            const sessionData = JSON.parse(sessionCookie);
            event.locals.user = {
                id: sessionData.id,
                username: sessionData.username || 'Admin',
                role: sessionData.role
            };
            if (process.env.NODE_ENV !== 'production') {
                console.log('[hooks.server] Session user:', event.locals.user);
                // Log all cookies for debugging
                if (event.cookies.getAll) {
                    console.log('[hooks.server] All cookies:', event.cookies.getAll());
                } else {
                    console.log('[hooks.server] session cookie:', event.cookies.get('session'));
                }
            }
        } catch (err) {
            console.warn('Failed to parse session cookie');
            event.cookies.delete('session', { path: '/' });
            event.locals.user = null;
        }
    } else {
        event.locals.user = null;
        if (process.env.NODE_ENV !== 'production') {
            console.log('[hooks.server] No session cookie present');
            // Log all cookies for debugging
            if (event.cookies.getAll) {
                console.log('[hooks.server] All cookies:', event.cookies.getAll());
            } else {
                console.log('[hooks.server] session cookie:', event.cookies.get('session'));
            }
        }
    }

    const publicRoutes = ['/login', '/logout'];
    const isPublicRoute = publicRoutes.includes(pathname);

    let response: Response;
    if (isPublicRoute) {
        // Public routes bypass all auth checks
        response = await resolve(event);
    
        // Add security headers
        response.headers.set('X-Content-Type-Options', 'nosniff');           // Prevent MIME sniffing
        response.headers.set('X-Frame-Options', 'DENY');                     // Prevent clickjacking
        response.headers.set('X-XSS-Protection', '1; mode=block');          // Enable XSS protection
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin'); // Control referrer
        if (process.env.NODE_ENV === 'production') {
            response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); // Force HTTPS for 1 year
        }
    } else if (pathname.startsWith('/super_admin')) {
        // ✅ SUPER ADMIN ONLY - Enforce role restriction
        if (!event.locals.user) {
            console.warn('[hooks.server] ✅ Unauthorized super_admin access (no session), redirecting to /login');
            throw redirect(303, '/login');
        }
        if (event.locals.user.role !== 'super_admin') {
            console.warn(`[hooks.server] ✅ Unauthorized super_admin access denied for user: ${event.locals.user.username} (role: ${event.locals.user.role})`);
            throw redirect(303, '/login');
        }
        // Super admin authenticated, allow request
        response = await resolve(event);
    } else if ((pathname.startsWith('/admin') || pathname.startsWith('/staff') || pathname.startsWith('/api')) && !event.locals.user) {
        if (pathname.startsWith('/api')) {
            console.warn('[hooks.server] Unauthorized API access');
            response = new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                }
            );
        } else {
            console.warn('[hooks.server] Unauthorized admin/staff access, redirecting to /login');
            throw redirect(303, '/login');
        }
    } else {
        // Allow request to proceed
        response = await resolve(event);
    }

    // Set CORS headers for LAN origins
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.delete('Access-Control-Allow-Credentials');
    if (process.env.NODE_ENV !== 'production') {
        console.log('[hooks.server] CORS headers set for public origin');
    }
    return addSecurityHeaders(response);
};

// Helper function - NO async operations
function addSecurityHeaders(response: Response): Response {
        // Log response errors for debugging
        if (response.status >= 400) {
            console.error('[hooks.server] Response error:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers),
            });
        }
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    if (process.env.NODE_ENV === 'production') {
        // Force HTTPS for 1 year, include subdomains
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        response.headers.set(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://uciyiafsfguraufwdgsj.supabase.co wss://uciyiafsfguraufwdgsj.supabase.co; form-action 'self';"
        );
    }

    return response;
}