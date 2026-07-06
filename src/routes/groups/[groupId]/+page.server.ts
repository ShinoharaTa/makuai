import { fail, redirect } from '@sveltejs/kit';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { loadGroupForMemberOr404, requireGroupAdmin } from '$lib/server/groups';
import { events, groupInvites, groupMembers, groups, user } from '$lib/server/db/schema';
import { redirectToLogin } from '$lib/server/redirect';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

async function loadMembership(e: Pick<RequestEvent, 'locals' | 'params' | 'url'>) {
	if (!e.locals.user) redirectToLogin(e.url.pathname);
	return loadGroupForMemberOr404(e.locals.db, e.params.groupId, e.locals.user!.id);
}

export const load: PageServerLoad = async (e) => {
	const { group, role } = await loadMembership(e);
	const db = e.locals.db;

	const groupEvents = await db
		.select({ id: events.id, title: events.title, status: events.status, venue: events.venue })
		.from(events)
		.where(eq(events.groupId, group.id))
		.orderBy(desc(events.createdAt));

	// メンバー一覧・招待は管理者のみ(誰がメンバーかは管理者以外に見せない)
	if (role !== 'admin') {
		return {
			group: { id: group.id, name: group.name },
			role,
			isOwner: false,
			events: groupEvents,
			members: null,
			invites: null
		};
	}

	const members = await db
		.select({
			id: groupMembers.id,
			userId: groupMembers.userId,
			name: user.name,
			role: groupMembers.role
		})
		.from(groupMembers)
		.innerJoin(user, eq(groupMembers.userId, user.id))
		.where(eq(groupMembers.groupId, group.id))
		.orderBy(asc(groupMembers.createdAt));

	const invites = await db
		.select({ id: groupInvites.id })
		.from(groupInvites)
		.where(and(eq(groupInvites.groupId, group.id), isNull(groupInvites.revokedAt)))
		.orderBy(asc(groupInvites.createdAt));

	return {
		group: { id: group.id, name: group.name },
		role,
		isOwner: group.ownerId === e.locals.user!.id,
		events: groupEvents,
		members,
		invites
	};
};

export const actions: Actions = {
	rename: async (e) => {
		const { group, role } = await loadMembership(e);
		requireGroupAdmin(role);
		const form = await e.request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name || name.length > 60) return fail(400, { message: 'グループ名が正しくありません' });
		await e.locals.db
			.update(groups)
			.set({ name, updatedAt: new Date() })
			.where(eq(groups.id, group.id));
		return { success: true };
	},

	createInvite: async (e) => {
		const { group, role } = await loadMembership(e);
		requireGroupAdmin(role);
		await e.locals.db.insert(groupInvites).values({
			id: nanoid(21),
			groupId: group.id,
			createdBy: e.locals.user!.id,
			createdAt: new Date()
		});
		return { success: true };
	},

	revokeInvite: async (e) => {
		const { group, role } = await loadMembership(e);
		requireGroupAdmin(role);
		const form = await e.request.formData();
		const inviteId = String(form.get('invite_id') ?? '');
		await e.locals.db
			.update(groupInvites)
			.set({ revokedAt: new Date() })
			.where(and(eq(groupInvites.id, inviteId), eq(groupInvites.groupId, group.id)));
		return { success: true };
	},

	removeMember: async (e) => {
		const { group, role } = await loadMembership(e);
		requireGroupAdmin(role);
		const form = await e.request.formData();
		const memberId = String(form.get('member_id') ?? '');
		const target = await e.locals.db.query.groupMembers.findFirst({
			where: and(eq(groupMembers.id, memberId), eq(groupMembers.groupId, group.id))
		});
		if (!target) return fail(404, { message: 'メンバーが見つかりません' });
		if (target.userId === group.ownerId) {
			return fail(409, { message: 'グループの作成者は除外できません' });
		}
		await e.locals.db.delete(groupMembers).where(eq(groupMembers.id, target.id));
		return { success: true };
	},

	leave: async (e) => {
		const { group } = await loadMembership(e);
		if (group.ownerId === e.locals.user!.id) {
			return fail(409, { message: '作成者は退出できません(グループ削除を使ってください)' });
		}
		await e.locals.db
			.delete(groupMembers)
			.where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, e.locals.user!.id)));
		redirect(303, '/groups');
	},

	// グループ削除は作成者のみ。紐づく調整は単発イベントとして残る(group_id は SET NULL)
	deleteGroup: async (e) => {
		const { group } = await loadMembership(e);
		if (group.ownerId !== e.locals.user!.id) {
			return fail(403, { message: 'グループ削除は作成者だけができます' });
		}
		await e.locals.db.delete(groups).where(eq(groups.id, group.id));
		redirect(303, '/groups');
	}
};
