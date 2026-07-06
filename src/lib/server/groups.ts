import { error } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import type { Database } from './db';
import { groupMembers, groups, type GroupRole } from './db/schema';

export type GroupRow = typeof groups.$inferSelect;

// 非メンバーにはグループの存在自体を知らせない(403 ではなく 404)
export async function loadGroupForMemberOr404(
	db: Database,
	groupId: string,
	userId: string
): Promise<{ group: GroupRow; role: GroupRole }> {
	const group = await db.query.groups.findFirst({ where: eq(groups.id, groupId) });
	const membership = group
		? await db.query.groupMembers.findFirst({
				where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
			})
		: undefined;
	if (!group || !membership) throw error(404, 'このグループは見つかりませんでした');
	return { group, role: membership.role };
}

export function requireGroupAdmin(role: GroupRole): void {
	if (role !== 'admin') throw error(403, 'この操作はグループ管理者だけができます');
}

export async function loadMyGroups(
	db: Database,
	userId: string
): Promise<{ id: string; name: string; role: GroupRole }[]> {
	return db
		.select({ id: groups.id, name: groups.name, role: groupMembers.role })
		.from(groupMembers)
		.innerJoin(groups, eq(groupMembers.groupId, groups.id))
		.where(eq(groupMembers.userId, userId))
		.orderBy(asc(groups.createdAt));
}

export async function isGroupMember(
	db: Database,
	groupId: string,
	userId: string
): Promise<boolean> {
	const row = await db.query.groupMembers.findFirst({
		where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
	});
	return Boolean(row);
}
