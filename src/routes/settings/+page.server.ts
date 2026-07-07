import { fail } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { hasCalendarConnection, CALENDAR_SCOPE } from '$lib/server/calendar';
import { ngRules } from '$lib/server/db/schema';
import { redirectToLogin } from '$lib/server/redirect';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirectToLogin(url.pathname);
	const rules = await locals.db
		.select()
		.from(ngRules)
		.where(eq(ngRules.userId, locals.user!.id))
		.orderBy(asc(ngRules.createdAt));
	return {
		rules: rules.map((r) => ({ id: r.id, days: r.days, startTime: r.startTime, endTime: r.endTime })),
		calendarConnected: await hasCalendarConnection(locals.db, locals.user!.id),
		calendarScope: CALENDAR_SCOPE,
		account: {
			name: locals.user!.name,
			email: locals.user!.email,
			image: locals.user!.image ?? null
		}
	};
};

function parseRuleForm(
	form: FormData
): { days: string; startTime: string; endTime: string } | string {
	const days = form
		.getAll('day')
		.map(String)
		.filter((d) => /^[0-6]$/.test(d));
	const startTime = String(form.get('start_time') ?? '').trim();
	const endTime = String(form.get('end_time') ?? '').trim();

	if (days.length === 0) return '曜日を1つ以上選んでください';
	if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
		return '時間帯が正しくありません';
	}
	if (endTime <= startTime) return '終了時刻は開始時刻より後にしてください';
	return { days: [...new Set(days)].sort().join(','), startTime, endTime };
}

export const actions: Actions = {
	add: async ({ locals, request, url }) => {
		if (!locals.user) redirectToLogin(url.pathname);
		const form = await request.formData();
		const input = parseRuleForm(form);
		if (typeof input === 'string') return fail(400, { message: input });

		await locals.db.insert(ngRules).values({
			id: nanoid(21),
			userId: locals.user!.id,
			...input,
			createdAt: new Date()
		});
		return { success: true };
	},

	update: async ({ locals, request, url }) => {
		if (!locals.user) redirectToLogin(url.pathname);
		const form = await request.formData();
		const id = String(form.get('rule_id') ?? '');
		const input = parseRuleForm(form);
		if (typeof input === 'string') return fail(400, { message: input });

		await locals.db
			.update(ngRules)
			.set(input)
			.where(and(eq(ngRules.id, id), eq(ngRules.userId, locals.user!.id)));
		return { success: true };
	},

	remove: async ({ locals, request, url }) => {
		if (!locals.user) redirectToLogin(url.pathname);
		const form = await request.formData();
		const id = String(form.get('rule_id') ?? '');
		await locals.db
			.delete(ngRules)
			.where(and(eq(ngRules.id, id), eq(ngRules.userId, locals.user!.id)));
		return { success: true };
	}
};
