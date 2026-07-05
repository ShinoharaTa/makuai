// Better Auth CLI (schema generate) 専用の設定。実行時には使われない。
// 実行時の設定は src/lib/server/auth.ts の createAuth を参照。
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

export const auth = betterAuth({
	database: drizzleAdapter({} as never, { provider: 'sqlite' }),
	socialProviders: {
		google: {
			clientId: 'placeholder',
			clientSecret: 'placeholder'
		}
	}
});
