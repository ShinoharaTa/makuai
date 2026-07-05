import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Database } from './db';
import { events } from './db/schema';

export type EventRow = typeof events.$inferSelect;

export async function loadEventOr404(db: Database, eventId: string): Promise<EventRow> {
	const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
	if (!event) throw error(404, 'この調整は見つかりませんでした');
	return event;
}

export function requireOwner(event: EventRow, user: { id: string } | null): void {
	if (!user || event.ownerId !== user.id) {
		throw error(403, 'この操作は主催者だけができます');
	}
}

// 回答(participant 作成含む)の可否。UI の disabled はあくまで補助で、ここが本体。
// ステータスは open ⇄ suspended の2値トグルなので、ブロックされるのは suspended のみ。
export function answerBlockedReason(event: EventRow): string | null {
	if (event.status === 'suspended') {
		return 'ただいま募集停止中です(候補の調整中)。再開までお待ちください';
	}
	return null;
}

// スロットの日時変更は suspended のときのみ(回答済みの前提が変わるため、回答を止めてから行う)。
// 追加・中止・復活はいつでも可。
export function slotEditBlockedReason(event: EventRow): string | null {
	if (event.status !== 'suspended') return '日時の変更は「募集停止」にしてから行ってください';
	return null;
}
