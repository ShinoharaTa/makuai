<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';

	let { data, children } = $props();

	async function signOut() {
		await authClient.signOut();
		await invalidateAll();
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>幕間 makuai — みんなでどの回に行く?</title>
</svelte:head>

<div class="shell">
	<header class="header">
		<a href="/" class="brand">
			<span class="brand-mark">幕間</span>
			<span class="brand-sub">makuai</span>
		</a>
		{#if data.user}
			<div class="user-box">
				{#if data.user.image}
					<img src={data.user.image} alt="" class="avatar" referrerpolicy="no-referrer" />
				{/if}
				<span class="user-name">{data.user.name}</span>
				<button class="btn btn-ghost btn-sm" onclick={signOut}>ログアウト</button>
			</div>
		{/if}
	</header>

	<main class="main">
		{@render children()}
	</main>

	<footer class="footer muted">幕間 makuai — エンタメのための日程調整</footer>
</div>

<style>
	.shell {
		max-width: 960px;
		margin: 0 auto;
		padding: 0 1rem;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 0;
		border-bottom: 1px solid var(--border);
	}

	.brand {
		display: flex;
		align-items: baseline;
		gap: 0.5em;
		text-decoration: none;
	}

	.brand:hover {
		text-decoration: none;
	}

	.brand-mark {
		font-size: 1.5rem;
		font-weight: 800;
		color: var(--text);
		letter-spacing: 0.1em;
	}

	.brand-sub {
		color: var(--accent-soft);
		font-weight: 600;
		letter-spacing: 0.08em;
	}

	.user-box {
		display: flex;
		align-items: center;
		gap: 0.6em;
	}

	.avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
	}

	.user-name {
		font-size: 0.9em;
	}

	.main {
		flex: 1;
		padding: 1.6rem 0 3rem;
	}

	.footer {
		padding: 1.2rem 0 2rem;
		font-size: 0.8em;
		text-align: center;
	}

	@media (max-width: 480px) {
		.user-name {
			display: none;
		}
	}
</style>
