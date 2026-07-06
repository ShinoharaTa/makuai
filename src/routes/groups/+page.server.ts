import { fail, redirect } from '@sveltejs/kit';
import { nanoid } from 'nanoid';
import { loadMyGroups } from '$lib/server/groups';
import { groupMembers, groups } from '$lib/server/db/schema';
import { redirectToLogin } from '$lib/server/redirect';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirectToLogin(url.pathname);
	return { groups: await loadMyGroups(locals.db, locals.user!.id) };
};

export const actions: Actions = {
	create: async ({ locals, request, url }) => {
		if (!locals.user) redirectToLogin(url.pathname);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { message: 'グループ名を入力してください' });
		if (name.length > 60) return fail(400, { message: 'グループ名が長すぎます' });

		const now = new Date();
		const groupId = nanoid(21);
		await locals.db.batch([
			locals.db.insert(groups).values({
				id: groupId,
				name,
				ownerId: locals.user!.id,
				createdAt: now,
				updatedAt: now
			}),
			locals.db.insert(groupMembers).values({
				id: nanoid(21),
				groupId,
				userId: locals.user!.id,
				role: 'admin',
				createdAt: now
			})
		]);
		redirect(303, `/groups/${groupId}`);
	}
};
