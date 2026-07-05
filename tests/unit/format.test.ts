import { describe, expect, it } from 'vitest';
import { formatSlot } from '../../src/lib/format';

describe('formatSlot', () => {
	it('曜日付きで日付と時刻を整形する', () => {
		expect(formatSlot({ date: '2026-08-01', startTime: '13:00', label: '' })).toBe(
			'8/1(土) 13:00'
		);
	});

	it('ラベルがあれば末尾に付く', () => {
		expect(formatSlot({ date: '2026-08-01', startTime: '18:00', label: '夜の部' })).toBe(
			'8/1(土) 18:00 夜の部'
		);
	});

	it('年またぎでも曜日が正しい', () => {
		expect(formatSlot({ date: '2027-01-01', startTime: '00:30', label: '' })).toBe(
			'1/1(金) 00:30'
		);
	});
});
