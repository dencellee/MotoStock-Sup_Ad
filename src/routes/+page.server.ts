import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// If user is already logged in, redirect to super_admin dashboard
	if (locals.user) {
		throw redirect(303, '/super_admin/dashboard');
	}

	// Redirect unauthenticated users to login
	throw redirect(303, '/login');
};
