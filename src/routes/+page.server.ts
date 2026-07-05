import { desc, eq } from 'drizzle-orm';
import { events, participants } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { hosted: null, joined: null };
	}
	const db = locals.db;

	const hosted = await db
		.select({
			id: events.id,
			title: events.title,
			venue: events.venue,
			status: events.status,
			createdAt: events.createdAt
		})
		.from(events)
		.where(eq(events.ownerId, locals.user.id))
		.orderBy(desc(events.createdAt));

	const joinedRows = await db
		.select({
			id: events.id,
			title: events.title,
			venue: events.venue,
			status: events.status,
			createdAt: events.createdAt
		})
		.from(events)
		.innerJoin(participants, eq(participants.eventId, events.id))
		.where(eq(participants.userId, locals.user.id))
		.orderBy(desc(events.createdAt));

	const hostedIds = new Set(hosted.map((e) => e.id));
	const joined = joinedRows.filter((e) => !hostedIds.has(e.id));

	return { hosted, joined };
};
