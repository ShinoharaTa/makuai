import { describe, expect, it } from 'vitest';
import { buildIcs, googleCalendarUrl } from '../../src/lib/ics';

const input = {
	uid: 'ev123',
	title: 'テストの集まり; 楽しい,やつ',
	venue: '大阪・梅田',
	memo: '持ち物:\nチケット',
	date: '2026-08-01',
	startTime: '13:00',
	url: 'https://makuai.example/e/ev123'
};

describe('buildIcs', () => {
	const ics = buildIcs(input);

	it('JST 13:00 が UTC 04:00 に変換される', () => {
		expect(ics).toContain('DTSTART:20260801T040000Z');
	});

	it('DTEND は所要3時間の仮定', () => {
		expect(ics).toContain('DTEND:20260801T070000Z');
	});

	it('セミコロン・カンマ・改行がエスケープされる', () => {
		expect(ics).toContain('SUMMARY:テストの集まり\\; 楽しい\\,やつ');
		expect(ics).toContain('持ち物:\\nチケット');
	});

	it('UID と URL が入る', () => {
		expect(ics).toContain('UID:ev123@makuai');
		expect(ics).toContain('URL:https://makuai.example/e/ev123');
	});
});

describe('googleCalendarUrl', () => {
	it('dates パラメータが UTC 区間になる', () => {
		const url = new URL(googleCalendarUrl(input));
		expect(url.searchParams.get('dates')).toBe('20260801T040000Z/20260801T070000Z');
		expect(url.searchParams.get('text')).toBe(input.title);
	});
});
