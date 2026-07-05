import { asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { answers, participants, slots, user, type Mark } from './db/schema';

export interface EventDetail {
	slots: (typeof slots.$inferSelect)[];
	participants: {
		id: string;
		userId: string;
		name: string;
		hasCustomName: boolean;
		image: string | null;
	}[];
	/** marks[participantId][slotId] = mark */
	marks: Record<string, Record<string, Mark>>;
	/** counts[slotId] = 集計 */
	counts: Record<string, { yes: number; maybe: number; no: number }>;
}

export async function loadEventDetail(db: Database, eventId: string): Promise<EventDetail> {
	const slotRows = await db
		.select()
		.from(slots)
		.where(eq(slots.eventId, eventId))
		.orderBy(asc(slots.date), asc(slots.startTime), asc(slots.label));

	const participantRows = await db
		.select({
			id: participants.id,
			userId: participants.userId,
			name: user.name,
			displayName: participants.displayName,
			image: user.image,
			createdAt: participants.createdAt
		})
		.from(participants)
		.innerJoin(user, eq(participants.userId, user.id))
		.where(eq(participants.eventId, eventId))
		.orderBy(asc(participants.createdAt));

	const participantIds = participantRows.map((p) => p.id);
	const answerRows = participantIds.length
		? await db
				.select({ participantId: answers.participantId, slotId: answers.slotId, mark: answers.mark })
				.from(answers)
				.where(inArray(answers.participantId, participantIds))
		: [];

	const marks: EventDetail['marks'] = {};
	const counts: EventDetail['counts'] = {};
	for (const s of slotRows) counts[s.id] = { yes: 0, maybe: 0, no: 0 };
	for (const a of answerRows) {
		(marks[a.participantId] ??= {})[a.slotId] = a.mark;
		const c = counts[a.slotId];
		if (c) c[a.mark]++;
	}

	return {
		slots: slotRows,
		// 表示名(イベントごとのニックネーム)があれば user.name より優先
		participants: participantRows.map(({ createdAt: _createdAt, name, displayName, ...p }) => ({
			...p,
			name: displayName?.trim() || name,
			hasCustomName: Boolean(displayName?.trim())
		})),
		marks,
		counts
	};
}
