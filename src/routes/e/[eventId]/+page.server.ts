import { fail } from '@sveltejs/kit';
import { and, count, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { googleCalendarUrl } from '$lib/ics';
import { suggestMarks } from '$lib/rules';
import { fetchBusyWindows, hasCalendarConnection } from '$lib/server/calendar';
import { isGroupMember } from '$lib/server/groups';
import { groups } from '$lib/server/db/schema';
import { loadEventDetail } from '$lib/server/events';
import { answerBlockedReason, loadEventOr404 } from '$lib/server/guards';
import { redirectToLogin } from '$lib/server/redirect';
import { answers, ngRules, participants, slots, MARKS, type Mark } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
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

	// 常設NGルール+カレンダー空き状況による下書き提案。未回答の有効スロットにだけ提案し、
	// 保存は本人の送信まで行わない(自動確定させない)
	const myRules = await db.select().from(ngRules).where(eq(ngRules.userId, locals.user!.id));
	const unanswered = detail.slots.filter((s) => !s.isCancelled && !myMarks[s.id]);

	// カレンダー連携済みなら候補期間の busy を取得(保存はしない。失敗時は静かに無効)
	let busy = null;
	if (unanswered.length > 0 && (await hasCalendarConnection(db, locals.user!.id))) {
		const dates = unanswered.map((s) => s.date).sort();
		busy = await fetchBusyWindows(
			locals.auth,
			locals.user!.id,
			`${dates[0]}T00:00:00+09:00`,
			`${dates[dates.length - 1]}T23:59:59+09:00`
		);
	}

	const suggestions = suggestMarks(
		unanswered.map((s) => ({ id: s.id, date: s.date, startTime: s.startTime })),
		myRules,
		busy
	);

	const confirmedSlot = event.confirmedSlotId
		? detail.slots.find((s) => s.id === event.confirmedSlotId)
		: undefined;

	// グループ名はメンバーにのみ表示(ゲストにはグループの存在を見せない)
	let group: { id: string; name: string } | null = null;
	if (event.groupId && (await isGroupMember(db, event.groupId, locals.user!.id))) {
		const row = await db.query.groups.findFirst({ where: eq(groups.id, event.groupId) });
		if (row) group = { id: row.id, name: row.name };
	}

	return {
		authed: true as const,
		group,
		suggestions,
		googleCalendarUrl: confirmedSlot
			? googleCalendarUrl({
					uid: event.id,
					title: event.title,
					venue: event.venue,
					memo: event.memo,
					date: confirmedSlot.date,
					startTime: confirmedSlot.startTime,
					url: `${url.origin}/e/${event.id}`
				})
			: null,
		myDisplayName: myParticipant?.hasCustomName ? myParticipant.name : '',
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

		const displayNameRaw = form.get('display_name');
		const displayName = displayNameRaw == null ? undefined : String(displayNameRaw).trim().slice(0, 30);

		const marksToSave: { slotId: string; mark: Mark }[] = [];
		const marksToClear: string[] = [];
		for (const slot of slotRows) {
			const raw = form.get(`slot_${slot.id}`);
			if (raw == null || raw === '') continue;
			if (slot.isCancelled) continue; // 中止候補への回答は黙って無視
			const value = String(raw);
			if (value === 'clear') {
				marksToClear.push(slot.id);
				continue;
			}
			const mark = value as Mark;
			if (!MARKS.includes(mark)) {
				return fail(400, { message: '回答の値が正しくありません' });
			}
			marksToSave.push({ slotId: slot.id, mark });
		}
		if (marksToSave.length === 0 && marksToClear.length === 0 && displayName === undefined) {
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
				.values({
					id: nanoid(21),
					eventId: event.id,
					userId: locals.user!.id,
					displayName: displayName || null,
					createdAt: now
				})
				.onConflictDoNothing();
			me = await findMe();
			if (!me) return fail(500, { message: '参加登録に失敗しました。もう一度お試しください' });
		} else if (displayName !== undefined && (displayName || null) !== me.displayName) {
			await db
				.update(participants)
				.set({ displayName: displayName || null })
				.where(eq(participants.id, me.id));
		}
		const participantId = me.id;

		const statements = [
			...marksToSave.map(({ slotId, mark }) =>
				db
					.insert(answers)
					.values({ id: nanoid(21), participantId, slotId, mark, updatedAt: now })
					.onConflictDoUpdate({
						target: [answers.participantId, answers.slotId],
						set: { mark, updatedAt: now }
					})
			),
			// 「未回答に戻す」は行ごと削除(未回答と同じ状態に戻す)
			...marksToClear.map((slotId) =>
				db
					.delete(answers)
					.where(and(eq(answers.participantId, participantId), eq(answers.slotId, slotId)))
			)
		];
		if (statements.length > 0) {
			await db.batch([statements[0], ...statements.slice(1)]);
		}

		return { success: true };
	},

	// イベントから退出(participant 削除。回答も cascade で消える)。
	// 自分のデータの撤回なのでステータスに関わらずいつでも可。
	leave: async ({ locals, params, url }) => {
		if (!locals.user) redirectToLogin(url.pathname);
		const db = locals.db;
		const event = await loadEventOr404(db, params.eventId);
		const me = await db.query.participants.findFirst({
			where: and(eq(participants.eventId, event.id), eq(participants.userId, locals.user!.id))
		});
		if (!me) return fail(409, { message: 'この調整には参加していません' });
		await db.delete(participants).where(eq(participants.id, me.id));
		return { success: true, left: true };
	}
};
