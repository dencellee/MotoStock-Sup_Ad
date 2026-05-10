import { redirect } from '@sveltejs/kit';
import { db } from '../lib/server/db/index.js';
import { users } from '../lib/server/db/schema.js';
import { count } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types.js';



export const load: LayoutServerLoad = async ({ locals }) => {
    // Only return user info from locals; no setup or user count check needed
    return {
        user: locals.user ? {
            id: locals.user.id,
            username: locals.user.username,
            role: locals.user.role
        } : null
    };
};