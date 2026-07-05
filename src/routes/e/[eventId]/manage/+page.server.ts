import { fail } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { loadEventDetail } from '$lib/server/events';
import {
	canTransition,
	loadEventOr404,
	requireOwner,
	slotAddBlockedReason,
	slotEditBlockedReason,
	type EventRow
} from '$lib/server/guards';
import { redirectToLogin } from '$lib/server/redirect';
import { events, slots, type EventStatus } from '$lib/server/db/schema';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

async function loadOwnedEvent(e: Pick<RequestEvent, 'locals' | 'params' | 'url'>): Promise<EventRow> {
	if (!e.locals.user) redirectToLogin(e.url.pathname);
	const event = await loadEventOr404(e.locals.db, e.params.eventId);
	requireOwner(event, e.locals.user);
	return event;
}

export const load: PageServerLoad = async (e) => {
	const event = await loadOwnedEvent(e);
	const detail = await loadEventDetail(e.locals.db, event.id);
	return {
		event: {
			id: event.id,
			title: event.title,
			venue: event.venue,
			memo: event.memo,
			status: event.status,
			confirmedSlotId: event.confirmedSlotId
		},
		detail
	};
};

function validateSlotInput(form: FormData): { date: string; startTime: string; label: string } | string {
	const date = String(form.get('date') ?? '').trim();
	const startTime = String(form.get('start_time') ?? '').trim();
	const label = String(form.get('label') ?? '').trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '公演日が正しくありません';
	if (!/^\d{2}:\d{2}$/.test(startTime)) return '開演時間が正しくありません';
	if (label.length > 30) return 'ラベルが長すぎます';
	return { date, startTime, label };
}

// ステータス遷移は「現在のステータス」を WHERE 条件に含めて更新し、
// 同時操作で遷移表を飛び越えないようにする
async function transition(e: Pick<RequestEvent, 'locals' | 'params' | 'url'>, to: EventStatus) {
	const event = await loadOwnedEvent(e);
	if (!canTransition(event.status, to)) {
		return fail(409, { message: `「${event.status}」から「${to}」には変更できません` });
	}
	await e.locals.db
		.update(events)
		.set({ status: to, updatedAt: new Date() })
		.where(and(eq(events.id, event.id), eq(events.status, event.status)));
	return { success: true };
}

export const actions: Actions = {
	suspend: (e) => transition(e, 'suspended'),
	reopen: (e) => transition(e, 'open'),
	close: (e) => transition(e, 'closed'),

	confirm: async (e) => {
		const event = await loadOwnedEvent(e);
		if (!canTransition(event.status, 'closed')) {
			return fail(409, { message: 'この調整はすでに募集終了しています' });
		}
		const form = await e.request.formData();
		const slotId = String(form.get('slot_id') ?? '');
		const slot = await e.locals.db.query.slots.findFirst({
			where: and(eq(slots.id, slotId), eq(slots.eventId, event.id))
		});
		if (!slot) return fail(400, { message: '確定する回を選んでください' });
		if (slot.isCancelled) return fail(409, { message: '中止した回は確定できません' });

		await e.locals.db
			.update(events)
			.set({ status: 'closed', confirmedSlotId: slot.id, updatedAt: new Date() })
			.where(and(eq(events.id, event.id), ne(events.status, 'closed')));
		return { success: true };
	},

	updateInfo: async (e) => {
		const event = await loadOwnedEvent(e);
		if (event.status === 'closed') {
			return fail(409, { message: '募集終了した調整は編集できません' });
		}
		const form = await e.request.formData();
		const title = String(form.get('title') ?? '').trim();
		const venue = String(form.get('venue') ?? '').trim();
		const memo = String(form.get('memo') ?? '').trim();
		if (!title) return fail(400, { message: '公演タイトルを入力してください' });

		await e.locals.db
			.update(events)
			.set({ title, venue: venue || null, memo: memo || null, updatedAt: new Date() })
			.where(and(eq(events.id, event.id), ne(events.status, 'closed')));
		return { success: true };
	},

	addSlot: async (e) => {
		const event = await loadOwnedEvent(e);
		const blocked = slotAddBlockedReason(event);
		if (blocked) return fail(409, { message: blocked });

		const form = await e.request.formData();
		const input = validateSlotInput(form);
		if (typeof input === 'string') return fail(400, { message: input });

		try {
			await e.locals.db.insert(slots).values({
				id: nanoid(21),
				eventId: event.id,
				date: input.date,
				startTime: input.startTime,
				label: input.label,
				createdAt: new Date()
			});
		} catch {
			return fail(400, { message: '同じ日時・ラベルの候補がすでにあります' });
		}
		return { success: true };
	},

	updateSlot: async (e) => {
		const event = await loadOwnedEvent(e);
		const blocked = slotEditBlockedReason(event);
		if (blocked) return fail(409, { message: blocked });

		const form = await e.request.formData();
		const slotId = String(form.get('slot_id') ?? '');
		const input = validateSlotInput(form);
		if (typeof input === 'string') return fail(400, { message: input });

		try {
			await e.locals.db
				.update(slots)
				.set({ date: input.date, startTime: input.startTime, label: input.label })
				.where(and(eq(slots.id, slotId), eq(slots.eventId, event.id)));
		} catch {
			return fail(400, { message: '同じ日時・ラベルの候補がすでにあります' });
		}
		return { success: true };
	},

	cancelSlot: async (e) => {
		const event = await loadOwnedEvent(e);
		const blocked = slotEditBlockedReason(event);
		if (blocked) return fail(409, { message: blocked });

		const form = await e.request.formData();
		const slotId = String(form.get('slot_id') ?? '');
		await e.locals.db
			.update(slots)
			.set({ isCancelled: true })
			.where(and(eq(slots.id, slotId), eq(slots.eventId, event.id)));
		return { success: true };
	},

	restoreSlot: async (e) => {
		const event = await loadOwnedEvent(e);
		const blocked = slotEditBlockedReason(event);
		if (blocked) return fail(409, { message: blocked });

		const form = await e.request.formData();
		const slotId = String(form.get('slot_id') ?? '');
		await e.locals.db
			.update(slots)
			.set({ isCancelled: false })
			.where(and(eq(slots.id, slotId), eq(slots.eventId, event.id)));
		return { success: true };
	}
};
