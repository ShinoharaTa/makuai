<script lang="ts">
	import { authClient } from '$lib/auth-client';

	let { data } = $props();
	let signingIn = $state(false);
	let errorMessage = $state('');

	async function signInWithGoogle() {
		signingIn = true;
		errorMessage = '';
		const { error } = await authClient.signIn.social({
			provider: 'google',
			callbackURL: data.redirectTo
		});
		if (error) {
			errorMessage = 'ログインに失敗しました。少し待ってからもう一度お試しください。';
			signingIn = false;
		}
	}
</script>

<section class="login">
	<div class="card login-card">
		<h1>はじめる前にログイン</h1>
		<p class="muted">回答や調整の作成には Google アカウントを使います。</p>
		{#if errorMessage}
			<p class="error-note">{errorMessage}</p>
		{/if}
		<button class="btn btn-primary" onclick={signInWithGoogle} disabled={signingIn}>
			{signingIn ? '接続中…' : 'Google でログイン'}
		</button>
		<p class="muted small">
			カレンダーの中身を読むことはありません。使うのはお名前とメールアドレスだけです。
		</p>
	</div>
</section>

<style>
	.login {
		display: flex;
		justify-content: center;
		padding: 3rem 0;
	}

	.login-card {
		max-width: 420px;
		text-align: center;
		display: grid;
		gap: 0.6rem;
		justify-items: center;
		padding: 2.2rem 2rem;
	}

	.small {
		font-size: 0.8em;
	}
</style>
