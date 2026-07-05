// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
/// <reference types="@cloudflare/workers-types" />
import type { Auth, SessionUser, Session } from '$lib/server/auth';
import type { Database } from '$lib/server/db';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			db: Database;
			auth: Auth;
			user: SessionUser | null;
			session: Session | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				DB: D1Database;
				BETTER_AUTH_URL: string;
				BETTER_AUTH_SECRET: string;
				GOOGLE_CLIENT_ID: string;
				GOOGLE_CLIENT_SECRET: string;
			};
			context: ExecutionContext;
		}
	}
}

export {};
