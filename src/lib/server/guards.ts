import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Database } from './db';
import { events, type EventStatus } from './db/schema';

export type EventRow = typeof events.$inferSelect;
export type SlotRow = { id: string; eventId: string; isCancelled: boolean };

// ステータス遷移表(実行者は全て主催者のみ)。closed は終端。
const TRANSITIONS: Record<EventStatus, EventStatus[]> = {
	open: ['suspended', 'closed'],
	suspended: ['open', 'closed'],
	closed: []
};

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

export function canTransition(from: EventStatus, to: EventStatus): boolean {
	return TRANSITIONS[from].includes(to);
}

// 回答(participant 作成含む)の可否。UI の disabled はあくまで補助で、ここが本体。
export function answerBlockedReason(event: EventRow): string | null {
	if (event.status === 'closed') return 'この調整は募集終了しています。回答の追加・変更はできません';
	if (event.status === 'suspended') return 'ただいま募集停止中です(候補日の調整中)。再開までお待ちください';
	return null;
}

// スロットの追加は open / suspended で可
export function slotAddBlockedReason(event: EventRow): string | null {
	if (event.status === 'closed') return '募集終了した調整には候補を追加できません';
	return null;
}

// スロットの中止・復活は open / suspended で可(「この回はなかったことに」は募集中でもできる)
export function slotCancelBlockedReason(event: EventRow): string | null {
	if (event.status === 'closed') return '募集終了した調整の候補は変更できません';
	return null;
}

// スロットの日時変更は suspended のときのみ(回答済みの前提が変わるため、回答を止めてから行う)
export function slotEditBlockedReason(event: EventRow): string | null {
	if (event.status === 'closed') return '募集終了した調整の候補は変更できません';
	if (event.status !== 'suspended') return '日時の変更は「募集停止」にしてから行ってください';
	return null;
}
