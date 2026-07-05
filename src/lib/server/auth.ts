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
				clientSecret: env.GOOGLE_CLIENT_SECRET
				// 将来カレンダー free/busy 連携を足すときはここに
				// accessType: 'offline' と scope 追加(refresh_token は account テーブルに自動保存される)
			}
		}
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type SessionUser = Auth['$Infer']['Session']['user'];
export type Session = Auth['$Infer']['Session']['session'];
