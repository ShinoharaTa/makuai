import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { createDb } from '$lib/server/db';
import { createAuth } from '$lib/server/auth';

// D1 バインディングはリクエストごとに platform.env から取る必要があるため、
// DB / Better Auth はここでリクエストごとに生成して locals に注入する(シングルトン禁止)。
export const handle: Handle = async ({ event, resolve }) => {
	if (building || !event.platform) {
		return resolve(event);
	}

	const db = createDb(event.platform.env.DB);
	const auth = createAuth(db, event.platform.env);
	event.locals.db = db;
	event.locals.auth = auth;

	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.user = session?.user ?? null;
	event.locals.session = session?.session ?? null;

	// /api/auth/* は svelteKitHandler が Better Auth に委譲する
	return svelteKitHandler({ event, resolve, auth, building });
};
