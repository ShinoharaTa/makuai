import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Database } from './db';
import * as schema from './db/schema';

export interface AuthEnv {
	BETTER_AUTH_URL: string;
	BETTER_AUTH_SECRET: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
}

// D1 はリクエストごとに platform.env から取る必要があるため、
// シングルトンにせず hooks.server.ts でリクエストごとに生成する。
export function createAuth(db: Database, env: AuthEnv) {
	return betterAuth({
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, { provider: 'sqlite', schema }),
		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
				// カレンダー連携(任意)で refresh_token を得るため offline を要求。
				// 基本ログインのスコープは変えず、freebusy スコープは linkSocial で追加同意を取る
				accessType: 'offline'
			}
		}
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type SessionUser = Auth['$Infer']['Session']['user'];
export type Session = Auth['$Infer']['Session']['session'];
