import { fail } from '@sveltejs/kit';
import { and, count, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { loadEventDetail } from '$lib/server/events';
import { answerBlockedReason, loadEventOr404 } from '$lib/server/guards';
import { redirectToLogin } from '$lib/server/redirect';
import { answers, participants, slots, MARKS, type Mark } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const db = locals.db;
	const event = await loadEventOr404(db, params.eventId);

	// 未ログインでもティーザー(タイトル・会場・件数)と OGP は見せる。
	// 回答状況・メンバー・メモはログイン後のみ。
	if (!locals.user) {
		const [{ value: slotCount }] = await db
			.select({ value: count() })
			.from(slots)
			.where(and(eq(slots.eventId, event.id), eq(slots.isCancelled, false)));
		const [{ value: participantCount }] = await db
			.select({ value: count() })
			.from(participants)
			.where(eq(participants.eventId, event.id));
		return {
			authed: false as const,
			event: {
				id: event.id,
				title: event.title,
				venue: event.venue,
				status: event.status
			},
			slotCount,
			participantCount
		};
	}

	const detail = await loadEventDetail(db, params.eventId);

	const myParticipant = detail.participants.find((p) => p.userId === locals.user!.id);
	const myMarks: Record<string, Mark> = myParticipant ? (detail.marks[myParticipant.id] ?? {}) : {};

	return {
		authed: true as const,
		event: {
			id: event.id,
			title: event.title,
			venue: event.venue,
			memo: event.memo,
			status: event.status,
			confirmedSlotId: event.confirmedSlotId
		},
		detail,
		isOwner: event.ownerId === locals.user!.id,
		hasAnswered: Boolean(myParticipant),
		myMarks,
		blockedReason: answerBlockedReason(event)
	};
};

export const actions: Actions = {
	answer: async ({ locals, params, request, url }) => {
		if (!locals.user) redirectToLogin(url.pathname);
		const db = locals.db;

		// ステータス検証はサーバー側が本体(UI の disabled は補助)。
		// closed では participant の新規作成も回答の upsert も一切通さない。
		const event = await loadEventOr404(db, params.eventId);
		const blocked = answerBlockedReason(event);
		if (blocked) return fail(409, { message: blocked });

		const slotRows = await db.select().from(slots).where(eq(slots.eventId, event.id));
		const form = await request.formData();
		const now = new Date();

		const marksToSave: { slotId: string; mark: Mark }[] = [];
		for (const slot of slotRows) {
			const raw = form.get(`slot_${slot.id}`);
			if (raw == null || raw === '') continue;
			if (slot.isCancelled) continue; // 中止回への回答は黙って無視
			const mark = String(raw) as Mark;
			if (!MARKS.includes(mark)) {
				return fail(400, { message: '回答の値が正しくありません' });
			}
			marksToSave.push({ slotId: slot.id, mark });
		}
		if (marksToSave.length === 0) {
			return fail(400, { message: 'どれか1つは回答してください' });
		}

		const findMe = () =>
			db.query.participants.findFirst({
				where: and(eq(participants.eventId, event.id), eq(participants.userId, locals.user!.id))
			});

		let me = await findMe();
		if (!me) {
			await db
				.insert(participants)
				.values({ id: nanoid(21), eventId: event.id, userId: locals.user!.id, createdAt: now })
				.onConflictDoNothing();
			me = await findMe();
			if (!me) return fail(500, { message: '参加登録に失敗しました。もう一度お試しください' });
		}
		const participantId = me.id;

		const upserts = marksToSave.map(({ slotId, mark }) =>
			db
				.insert(answers)
				.values({ id: nanoid(21), participantId, slotId, mark, updatedAt: now })
				.onConflictDoUpdate({
					target: [answers.participantId, answers.slotId],
					set: { mark, updatedAt: now }
				})
		);
		await db.batch([upserts[0], ...upserts.slice(1)]);

		return { success: true };
	}
};
