import { and, eq } from 'drizzle-orm';
import type { BusyWindow } from '$lib/rules';
import type { Auth } from './auth';
import type { Database } from './db';
import { account } from './db/schema';

// FreeBusy(空き/埋まりの時間帯)だけを読むスコープ。
// 予定のタイトル・内容・場所は取得すらしない(REQUIREMENTS プライバシー原則)
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.freebusy';

export async function hasCalendarConnection(db: Database, userId: string): Promise<boolean> {
	const row = await db.query.account.findFirst({
		where: and(eq(account.userId, userId), eq(account.providerId, 'google'))
	});
	return Boolean(row?.scope?.includes('calendar.freebusy'));
}

/**
 * Google Calendar FreeBusy API から busy 時間帯を取得する。
 * 失敗時(トークン失効・権限取り消し・API エラー)は null を返し、
 * 呼び出し側は「連携なし」として扱う(ページを壊さない)。
 * busy はレスポンスとしてのみ扱い、サーバーに保存しない。
 */
export async function fetchBusyWindows(
	auth: Auth,
	userId: string,
	timeMinIso: string,
	timeMaxIso: string
): Promise<BusyWindow[] | null> {
	try {
		const { accessToken } = await auth.api.getAccessToken({
			body: { providerId: 'google', userId }
		});
		if (!accessToken) return null;

		const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				timeMin: timeMinIso,
				timeMax: timeMaxIso,
				items: [{ id: 'primary' }]
			})
		});
		if (!res.ok) return null;

		const data = (await res.json()) as {
			calendars?: { primary?: { busy?: { start: string; end: string }[] } };
		};
		const busy = data.calendars?.primary?.busy ?? [];
		return busy.map((w) => ({ startMs: Date.parse(w.start), endMs: Date.parse(w.end) }));
	} catch {
		return null;
	}
}
