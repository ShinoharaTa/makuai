import { fail, redirect } from '@sveltejs/kit';
import { nanoid } from 'nanoid';
import { events, slots } from '$lib/server/db/schema';
import { redirectToLogin } from '$lib/server/redirect';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirectToLogin(url.pathname);
	return {};
};

export const actions: Actions = {
	create: async ({ locals, request, url }) => {
		if (!locals.user) redirectToLogin(url.pathname);
		const db = locals.db;

		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const venue = String(form.get('venue') ?? '').trim();
		const memo = String(form.get('memo') ?? '').trim();
		const dates = form.getAll('slot_date').map(String);
		const times = form.getAll('slot_time').map(String);
		const labels = form.getAll('slot_label').map(String);

		if (!title) {
			return fail(400, { message: '公演タイトルを入力してください' });
		}

		const slotInputs: { date: string; startTime: string; label: string }[] = [];
		for (let i = 0; i < dates.length; i++) {
			const date = dates[i]?.trim();
			const startTime = times[i]?.trim();
			const label = (labels[i] ?? '').trim();
			if (!date && !startTime) continue; // 空行はスキップ
			if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
				return fail(400, { message: `候補 ${i + 1} の公演日が正しくありません` });
			}
			if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
				return fail(400, { message: `候補 ${i + 1} の開演時間が正しくありません` });
			}
			slotInputs.push({ date, startTime, label });
		}

		if (slotInputs.length === 0) {
			return fail(400, { message: '公演の候補(日付と開演時間)を1つ以上入れてください' });
		}

		const seen = new Set<string>();
		for (const s of slotInputs) {
			const key = `${s.date} ${s.startTime} ${s.label}`;
			if (seen.has(key)) {
				return fail(400, { message: `同じ候補が重複しています: ${key}` });
			}
			seen.add(key);
		}

		const now = new Date();
		const eventId = nanoid(21);
		await db.batch([
			db.insert(events).values({
				id: eventId,
				ownerId: locals.user.id,
				title,
				venue: venue || null,
				memo: memo || null,
				status: 'open',
				createdAt: now,
				updatedAt: now
			}),
			db.insert(slots).values(
				slotInputs.map((s) => ({
					id: nanoid(21),
					eventId,
					date: s.date,
					startTime: s.startTime,
					label: s.label,
					createdAt: now
				}))
			)
		]);

		redirect(303, `/e/${eventId}`);
	}
};
