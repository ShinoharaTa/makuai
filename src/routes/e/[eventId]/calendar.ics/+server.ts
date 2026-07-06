import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { buildIcs } from '$lib/ics';
import { loadEventOr404 } from '$lib/server/guards';
import { redirectToLogin } from '$lib/server/redirect';
import { slots } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user) redirectToLogin(url.pathname);
	const event = await loadEventOr404(locals.db, params.eventId);
	if (!event.confirmedSlotId) throw error(404, 'まだ日程が確定していません');

	const slot = await locals.db.query.slots.findFirst({
		where: and(eq(slots.id, event.confirmedSlotId), eq(slots.eventId, event.id))
	});
	if (!slot) throw error(404, '確定した候補が見つかりません');

	const ics = buildIcs({
		uid: event.id,
		title: event.title,
		venue: event.venue,
		memo: event.memo,
		date: slot.date,
		startTime: slot.startTime,
		url: `${url.origin}/e/${event.id}`
	});

	return new Response(ics, {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': `attachment; filename="makuai-${event.id}.ics"`
		}
	});
};
