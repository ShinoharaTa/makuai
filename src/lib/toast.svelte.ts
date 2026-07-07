// 軽量トースト。ページ側の enhance コールバックから toast() を呼び、
// レイアウトの <Toasts /> が表示する(クライアント専用。SSR では何もしない)

export interface Toast {
	id: number;
	text: string;
	kind: 'success' | 'error' | 'info';
	href?: string;
	linkText?: string;
}

let nextId = 0;

export const toasts = $state<Toast[]>([]);

export function toast(
	text: string,
	opts: { kind?: Toast['kind']; href?: string; linkText?: string; durationMs?: number } = {}
): void {
	const id = ++nextId;
	toasts.push({ id, text, kind: opts.kind ?? 'success', href: opts.href, linkText: opts.linkText });
	setTimeout(() => dismiss(id), opts.durationMs ?? 5000);
}

export function dismiss(id: number): void {
	const i = toasts.findIndex((t) => t.id === id);
	if (i >= 0) toasts.splice(i, 1);
}
