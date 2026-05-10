import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, locals }) => {
    // Clear user session (implementation may vary)
    const session = (locals as any).session;
    if (session) {
        session.destroy();
    }
    // Delete the session cookie
    cookies.delete('session', { path: '/' });
    return json({ success: true, message: 'Logged out' });
};
