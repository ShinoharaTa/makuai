const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function formatSlot(slot: { date: string; startTime: string; label: string }): string {
	const [y, m, d] = slot.date.split('-').map(Number);
	const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
	const base = `${m}/${d}(${wd}) ${slot.startTime}`;
	return slot.label ? `${base} ${slot.label}` : base;
}
