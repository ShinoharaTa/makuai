import { redirect } from '@sveltejs/kit';

// オープンリダイレクト防止: サイト内パスのみ許可
export function safeRedirectTo(raw: string | null): string {
	if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
	return '/';
}

export function redirectToLogin(pathname: string): never {
	redirect(302, `/login?redirectTo=${encodeURIComponent(pathname)}`);
}
