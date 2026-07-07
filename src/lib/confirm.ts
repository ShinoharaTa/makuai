import type { SubmitFunction } from '@sveltejs/kit';

// 確認ダイアログ付き form 送信。
// use:enhance は onsubmit の preventDefault() を無視するため、必ず cancel() で止める(#13)
export function withConfirm(message: string): SubmitFunction {
	return ({ cancel }) => {
		if (!confirm(message)) {
			cancel();
			return;
		}
		return async ({ update }) => {
			await update();
		};
	};
}
