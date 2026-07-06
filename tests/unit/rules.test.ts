import { describe, expect, it } from 'vitest';
import { dayOfWeek, slotHitsRule, suggestMarks } from '../../src/lib/rules';

// 2026-08-01 は土曜、2026-08-03 は月曜
const WEEKDAY_WORK = { days: '1,2,3,4,5', startTime: '09:00', endTime: '18:00' };
const LATE_NIGHT = { days: '0,1,2,3,4,5,6', startTime: '22:00', endTime: '23:59' };

describe('dayOfWeek', () => {
	it('曜日を正しく返す', () => {
		expect(dayOfWeek('2026-08-01')).toBe(6); // 土
		expect(dayOfWeek('2026-08-03')).toBe(1); // 月
	});
});

describe('slotHitsRule', () => {
	it('平日日中のスロットは仕事ルールに当たる', () => {
		expect(slotHitsRule({ id: 's', date: '2026-08-03', startTime: '13:00' }, WEEKDAY_WORK)).toBe(true);
	});

	it('土曜のスロットは平日ルールに当たらない', () => {
		expect(slotHitsRule({ id: 's', date: '2026-08-01', startTime: '13:00' }, WEEKDAY_WORK)).toBe(false);
	});

	it('平日 18:30 開始(所要3時間仮定)は 9-18 ルールに当たらない', () => {
		expect(slotHitsRule({ id: 's', date: '2026-08-03', startTime: '18:30' }, WEEKDAY_WORK)).toBe(false);
	});

	it('平日 16:30 開始は終業前に始まるので当たる', () => {
		expect(slotHitsRule({ id: 's', date: '2026-08-03', startTime: '16:30' }, WEEKDAY_WORK)).toBe(true);
	});

	it('20:00 開始(〜23:00)は 22時以降ルールに当たる', () => {
		expect(slotHitsRule({ id: 's', date: '2026-08-01', startTime: '20:00' }, LATE_NIGHT)).toBe(true);
	});

	it('18:00 開始(〜21:00)は 22時以降ルールに当たらない', () => {
		expect(slotHitsRule({ id: 's', date: '2026-08-01', startTime: '18:00' }, LATE_NIGHT)).toBe(false);
	});

	it('終了が開始以前の壊れたルールは無視される', () => {
		expect(
			slotHitsRule(
				{ id: 's', date: '2026-08-03', startTime: '13:00' },
				{ days: '1', startTime: '18:00', endTime: '09:00' }
			)
		).toBe(false);
	});
});

describe('suggestMarks', () => {
	const slots = [
		{ id: 'mon', date: '2026-08-03', startTime: '13:00' },
		{ id: 'sat', date: '2026-08-01', startTime: '13:00' }
	];

	it('ルールなしなら提案しない', () => {
		expect(suggestMarks(slots, [])).toEqual({});
	});

	it('当たったスロットは no、それ以外は yes', () => {
		expect(suggestMarks(slots, [WEEKDAY_WORK])).toEqual({ mon: 'no', sat: 'yes' });
	});

	it('ルールなしでもカレンダー連携済み(busy=[])なら全部 yes を提案', () => {
		expect(suggestMarks(slots, [], [])).toEqual({ mon: 'yes', sat: 'yes' });
	});

	it('busy と重なるスロットは no(土曜 13:00-16:00 と重なる busy)', () => {
		const busy = [
			{
				startMs: Date.parse('2026-08-01T14:00:00+09:00'),
				endMs: Date.parse('2026-08-01T15:00:00+09:00')
			}
		];
		expect(suggestMarks(slots, [], busy)).toEqual({ mon: 'yes', sat: 'no' });
	});

	it('busy 取得失敗(null)はルールのみで判定', () => {
		expect(suggestMarks(slots, [WEEKDAY_WORK], null)).toEqual({ mon: 'no', sat: 'yes' });
	});

	it('ルールと busy は OR で合成される', () => {
		const busy = [
			{
				startMs: Date.parse('2026-08-01T13:30:00+09:00'),
				endMs: Date.parse('2026-08-01T14:00:00+09:00')
			}
		];
		expect(suggestMarks(slots, [WEEKDAY_WORK], busy)).toEqual({ mon: 'no', sat: 'no' });
	});

	it('スロット終了後に始まる busy は当たらない', () => {
		const busy = [
			{
				startMs: Date.parse('2026-08-01T16:30:00+09:00'),
				endMs: Date.parse('2026-08-01T18:00:00+09:00')
			}
		];
		expect(suggestMarks(slots, [], busy)).toEqual({ mon: 'yes', sat: 'yes' });
	});
});
