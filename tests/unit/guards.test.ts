import { describe, expect, it } from 'vitest';
import {
	answerBlockedReason,
	requireOwner,
	slotEditBlockedReason,
	type EventRow
} from '../../src/lib/server/guards';

function event(overrides: Partial<EventRow> = {}): EventRow {
	return {
		id: 'ev1',
		ownerId: 'owner1',
		groupId: null,
		title: 't',
		venue: null,
		memo: null,
		status: 'open',
		confirmedSlotId: null,
		createdAt: new Date(0),
		updatedAt: new Date(0),
		...overrides
	};
}

describe('answerBlockedReason', () => {
	it('open は回答可', () => {
		expect(answerBlockedReason(event())).toBeNull();
	});

	it('suspended は回答ブロック', () => {
		expect(answerBlockedReason(event({ status: 'suspended' }))).toMatch('募集停止中');
	});

	it('確定していても open なら回答可(確定はステータスと独立)', () => {
		expect(answerBlockedReason(event({ confirmedSlotId: 's1' }))).toBeNull();
	});
});

describe('slotEditBlockedReason', () => {
	it('open では日時変更不可', () => {
		expect(slotEditBlockedReason(event())).toMatch('募集停止');
	});

	it('suspended では日時変更可', () => {
		expect(slotEditBlockedReason(event({ status: 'suspended' }))).toBeNull();
	});
});

describe('requireOwner', () => {
	it('主催者本人は通る', () => {
		expect(() => requireOwner(event(), { id: 'owner1' })).not.toThrow();
	});

	it('他人は 403', () => {
		try {
			requireOwner(event(), { id: 'someone-else' });
			expect.unreachable('403 が投げられるはず');
		} catch (e) {
			expect((e as { status: number }).status).toBe(403);
		}
	});

	it('未ログインは 403', () => {
		try {
			requireOwner(event(), null);
			expect.unreachable('403 が投げられるはず');
		} catch (e) {
			expect((e as { status: number }).status).toBe(403);
		}
	});
});
