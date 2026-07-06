import { error, redirect } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { isGroupMember } from '$lib/server/groups';
import { groupInvites, groupMembers, groups } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

async function loadActiveInvite(db: App.Locals['db'], inviteId: string) {
	const invite = await db.query.groupInvites.findFirst({
		where: and(eq(groupInvites.id, inviteId), isNull(groupInvites.revokedAt))
	});
	const group = invite
		? await db.query.groups.findFirst({ where: eq(groups.id, invite.groupId) })
		: undefined;
	if (!invite || !group) throw error(404, 'この招待は使えません(無効化されたか、存在しません)');
	return { invite, group };
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const { group } = await loadActiveInvite(locals.db, params.inviteId);

	// ログイン済みで既にメンバーならそのままグループへ
	if (locals.user && (await isGroupMember(locals.db, group.id, locals.user.id))) {
		redirect(303, `/groups/${group.id}`);
	}

	return {
		groupName: group.name,
		loggedIn: Boolean(locals.user)
	};
};

export const actions: Actions = {
	join: async ({ locals, params }) => {
		if (!locals.user) {
			redirect(302, `/login?redirectTo=${encodeURIComponent(`/g/${params.inviteId}`)}`);
		}
		const { group } = await loadActiveInvite(locals.db, params.inviteId);
		await locals.db
			.insert(groupMembers)
			.values({
				id: nanoid(21),
				groupId: group.id,
				userId: locals.user!.id,
				role: 'member',
				createdAt: new Date()
			})
			.onConflictDoNothing();
		redirect(303, `/groups/${group.id}`);
	}
};
