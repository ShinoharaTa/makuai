import { loadDashboard } from '$lib/server/dashboard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { dashboard: null };
	}
	return { dashboard: await loadDashboard(locals.db, locals.user.id) };
};
