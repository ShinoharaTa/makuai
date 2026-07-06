// 常設NGルールの判定(純粋関数)。
// スロットには終了時刻がないため、所要時間を一律で仮定して重なりを判定する。
// TODO(#3 フォローアップ): イベントごとの所要時間設定を導入したらここを置き換える

export const ASSUMED_DURATION_MIN = 180;

export interface NgRuleInput {
	days: string; // '0,6' のような曜日 CSV(0=日〜6=土)
	startTime: string; // 'HH:MM'
	endTime: string; // 'HH:MM'
}

export interface SlotInput {
	id: string;
	date: string; // 'YYYY-MM-DD'
	startTime: string; // 'HH:MM'
}

function toMinutes(hhmm: string): number {
	const [h, m] = hhmm.split(':').map(Number);
	return h * 60 + m;
}

export function dayOfWeek(date: string): number {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(y, m - 1, d).getDay();
}

// スロット(開始〜開始+仮定所要時間)がルールの NG 時間帯と重なるか。
// 日跨ぎは当日 24:00 で打ち切る単純化(深夜イベントは稀なため)
export function slotHitsRule(slot: SlotInput, rule: NgRuleInput): boolean {
	const days = rule.days.split(',').map(Number);
	if (!days.includes(dayOfWeek(slot.date))) return false;
	const slotStart = toMinutes(slot.startTime);
	const slotEnd = Math.min(slotStart + ASSUMED_DURATION_MIN, 24 * 60);
	const ruleStart = toMinutes(rule.startTime);
	const ruleEnd = toMinutes(rule.endTime);
	if (ruleEnd <= ruleStart) return false; // 不正・空の時間帯は無視
	return slotStart < ruleEnd && ruleStart < slotEnd;
}

// カレンダー取り込み(free/busy)の busy 時間帯。epoch ミリ秒。
// 中身(タイトル等)は存在しない — 取得すらしない設計(REQUIREMENTS 原則)
export interface BusyWindow {
	startMs: number;
	endMs: number;
}

export function slotStartMs(slot: Pick<SlotInput, 'date' | 'startTime'>): number {
	return Date.parse(`${slot.date}T${slot.startTime}:00+09:00`);
}

export function slotHitsBusy(slot: SlotInput, busy: BusyWindow[]): boolean {
	const start = slotStartMs(slot);
	const end = start + ASSUMED_DURATION_MIN * 60_000;
	return busy.some((w) => start < w.endMs && w.startMs < end);
}

/**
 * ルールと busy 時間帯から各スロットへの提案を作る。
 * どちらかに当たれば ×(no)、当たらなければ ○(yes)。△ は提案しない。
 * ルールが1件もなく、カレンダー未連携(busy === null/undefined)なら提案しない。
 */
export function suggestMarks(
	slots: SlotInput[],
	rules: NgRuleInput[],
	busy?: BusyWindow[] | null
): Record<string, 'yes' | 'no'> {
	if (rules.length === 0 && busy == null) return {};
	const result: Record<string, 'yes' | 'no'> = {};
	for (const slot of slots) {
		const hit =
			rules.some((rule) => slotHitsRule(slot, rule)) || (busy != null && slotHitsBusy(slot, busy));
		result[slot.id] = hit ? 'no' : 'yes';
	}
	return result;
}
