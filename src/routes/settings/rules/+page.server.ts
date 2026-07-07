import { redirect } from '@sveltejs/kit';

// 旧 URL(/settings/rules)は設定統合(#32)で /settings へ
export function load(): never {
	redirect(301, '/settings');
}
