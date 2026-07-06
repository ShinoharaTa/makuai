import { eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import {
	answers,
	events,
	groupMembers,
	groups,
	participants,
	slots,
	type EventStatus,
	type Mark
} from './db/schema';

export interface DashboardSlot {
	id: string;
	date: string;
	startTime: string;
	label: string;
}

export interface DashboardEvent {
	id: string;
	title: string;
	venue: string | null;
	status: EventStatus;
	isOwner: boolean;
	/** 自分がメンバーであるグループ経由の場合のみグループ名が入る(ゲストには見せない) */
	groupName: string | null;
	createdAt: number; // epoch ms(ソート用)
	/** 中止を除いた候補(クイック回答用) */
	activeSlots: DashboardSlot[];
	/** 自分の回答 slotId -> mark */
	myMarks: Record<string, Mark>;
	/** activeSlots のうち未回答の数 */
	unansweredCount: number;
	/** 確定スロット(確定済みイベントのみ)と、その回への自分の回答 */
	confirmed: {
		date: string;
		startTime: string;
		label: string;
		myMark: Mark | null;
		/** 確定日が過去か(JST 基準)。過去ならアーカイブ扱い */
		isPast: boolean;
	} | null;
}

// JST での今日の日付 'YYYY-MM-DD'
function todayJst(): string {
	return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// 自分に関係する全調整のサマリ。
// 将来 #11(グループ)でグループ紐づけイベントを合流させる入口もここにする。
export async function loadDashboard(db: Database, userId: string): Promise<DashboardEvent[]> {
	const hosted = await db.select().from(events).where(eq(events.ownerId, userId));
	const joined = await db
		.select({ event: events, participantId: participants.id })
		.from(events)
		.innerJoin(participants, eq(participants.eventId, events.id))
		.where(eq(participants.userId, userId));

	// 自分がメンバーのグループ宛の調整は、未回答でもダッシュボードに出す
	const myGroups = await db
		.select({ groupId: groupMembers.groupId, groupName: groups.name })
		.from(groupMembers)
		.innerJoin(groups, eq(groupMembers.groupId, groups.id))
		.where(eq(groupMembers.userId, userId));
	const groupNameById = new Map(myGroups.map((g) => [g.groupId, g.groupName]));
	const groupEvents = myGroups.length
		? await db
				.select()
				.from(events)
				.where(inArray(events.groupId, [...groupNameById.keys()]))
		: [];

	const byId = new Map<
		string,
		{ event: typeof events.$inferSelect; participantId: string | null; isOwner: boolean }
	>();
	for (const event of hosted) byId.set(event.id, { event, participantId: null, isOwner: true });
	for (const { event, participantId } of joined) {
		const existing = byId.get(event.id);
		if (existing) existing.participantId = participantId;
		else byId.set(event.id, { event, participantId, isOwner: false });
	}
	for (const event of groupEvents) {
		if (!byId.has(event.id)) byId.set(event.id, { event, participantId: null, isOwner: false });
	}
	if (byId.size === 0) return [];

	const eventIds = [...byId.keys()];
	const slotRows = await db.select().from(slots).where(inArray(slots.eventId, eventIds));

	const participantIds = [...byId.values()]
		.map((entry) => entry.participantId)
		.filter((id): id is string => id !== null);
	const answerRows = participantIds.length
		? await db
				.select({ participantId: answers.participantId, slotId: answers.slotId, mark: answers.mark })
				.from(answers)
				.where(inArray(answers.participantId, participantIds))
		: [];

	const marksByParticipant = new Map<string, Record<string, Mark>>();
	for (const a of answerRows) {
		const marks = marksByParticipant.get(a.participantId) ?? {};
		marks[a.slotId] = a.mark;
		marksByParticipant.set(a.participantId, marks);
	}

	const slotsByEvent = new Map<string, (typeof slots.$inferSelect)[]>();
	for (const slot of slotRows) {
		const list = slotsByEvent.get(slot.eventId) ?? [];
		list.push(slot);
		slotsByEvent.set(slot.eventId, list);
	}

	const today = todayJst();
	const result: DashboardEvent[] = [];
	for (const { event, participantId, isOwner } of byId.values()) {
		const eventSlots = (slotsByEvent.get(event.id) ?? []).sort((a, b) =>
			`${a.date} ${a.startTime} ${a.label}`.localeCompare(`${b.date} ${b.startTime} ${b.label}`)
		);
		const myMarks = participantId ? (marksByParticipant.get(participantId) ?? {}) : {};

		const activeSlots = eventSlots
			.filter((s) => !s.isCancelled)
			.map((s) => ({ id: s.id, date: s.date, startTime: s.startTime, label: s.label }));
		const unansweredCount = activeSlots.filter((s) => !myMarks[s.id]).length;

		let confirmed: DashboardEvent['confirmed'] = null;
		if (event.confirmedSlotId) {
			const slot = eventSlots.find((s) => s.id === event.confirmedSlotId);
			if (slot) {
				confirmed = {
					date: slot.date,
					startTime: slot.startTime,
					label: slot.label,
					myMark: myMarks[slot.id] ?? null,
					isPast: slot.date < today
				};
			}
		}

		result.push({
			id: event.id,
			title: event.title,
			venue: event.venue,
			status: event.status,
			isOwner,
			groupName: event.groupId ? (groupNameById.get(event.groupId) ?? null) : null,
			createdAt: event.createdAt.getTime(),
			activeSlots,
			myMarks,
			unansweredCount,
			confirmed
		});
	}
	return result;
}
