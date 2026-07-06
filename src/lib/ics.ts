import { ASSUMED_DURATION_MIN } from './rules';

export interface IcsEventInput {
	uid: string;
	title: string;
	venue: string | null;
	memo: string | null;
	date: string; // 'YYYY-MM-DD'(JST)
	startTime: string; // 'HH:MM'(JST)
	url: string;
}

// JST のナイーブ日時を UTC の ICS 形式(YYYYMMDDTHHMMSSZ)へ
function toIcsUtc(date: string, time: string, offsetMin = 0): string {
	const epoch = Date.parse(`${date}T${time}:00+09:00`) + offsetMin * 60_000;
	return new Date(epoch).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeText(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// 折返し(75オクテット)は簡略化のため行わない(主要カレンダーは長行を受理する)
export function buildIcs(event: IcsEventInput): string {
	const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//makuai//makuai//JA',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:${event.uid}@makuai`,
		`DTSTAMP:${now}`,
		`DTSTART:${toIcsUtc(event.date, event.startTime)}`,
		`DTEND:${toIcsUtc(event.date, event.startTime, ASSUMED_DURATION_MIN)}`,
		`SUMMARY:${escapeText(event.title)}`,
		...(event.venue ? [`LOCATION:${escapeText(event.venue)}`] : []),
		`DESCRIPTION:${escapeText([event.memo, event.url].filter(Boolean).join('\n\n'))}`,
		`URL:${event.url}`,
		'END:VEVENT',
		'END:VCALENDAR'
	];
	return lines.join('\r\n') + '\r\n';
}

// Google カレンダーの予定作成テンプレート URL(API 不使用・任意の出力先の1つ)
export function googleCalendarUrl(event: IcsEventInput): string {
	const params = new URLSearchParams({
		action: 'TEMPLATE',
		text: event.title,
		dates: `${toIcsUtc(event.date, event.startTime)}/${toIcsUtc(event.date, event.startTime, ASSUMED_DURATION_MIN)}`,
		details: [event.memo, event.url].filter(Boolean).join('\n\n'),
		...(event.venue ? { location: event.venue } : {})
	});
	return `https://calendar.google.com/calendar/render?${params}`;
}
