import { redirect } from '@sveltejs/kit';
import { safeRedirectTo } from '$lib/server/redirect';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const redirectTo = safeRedirectTo(url.searchParams.get('redirectTo'));
	if (locals.user) {
		redirect(303, redirectTo);
	}
	return { redirectTo };
};
