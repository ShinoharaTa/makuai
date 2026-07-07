<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { data, children } = $props();

	const navItems = [
		{ href: '/', icon: '🎫', label: 'ダッシュボード' },
		{ href: '/groups', icon: '👥', label: 'グループ' },
		{ href: '/settings', icon: '⚙', label: '設定' }
	];

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="shell">
	<header class="header">
		<a href="/" class="brand">
			<span class="brand-mark">幕間</span>
			<span class="brand-sub">makuai</span>
		</a>
		{#if data.user}
			<nav class="nav" aria-label="メイン">
				{#each navItems as item (item.href)}
					<a href={item.href} class="nav-link" class:active={isActive(item.href)}>
						<span class="nav-icon" aria-hidden="true">{item.icon}</span>
						<span class="nav-label">{item.label}</span>
					</a>
				{/each}
				<a href="/settings" class="nav-avatar" title={data.user.name}>
					{#if data.user.image}
						<img src={data.user.image} alt={data.user.name} class="avatar" referrerpolicy="no-referrer" />
					{/if}
				</a>
			</nav>
		{/if}
	</header>

	<main class="main">
		{@render children()}
	</main>

	<footer class="footer muted">幕間 makuai — みんなの日程調整</footer>
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
		gap: 0.4rem 1rem;
		flex-wrap: wrap;
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

	.nav {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.nav-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35em;
		padding: 0.4em 0.7em;
		border-radius: 999px;
		color: var(--text-dim);
		font-size: 0.9em;
	}

	.nav-link:hover {
		text-decoration: none;
		color: var(--text);
		background: var(--surface);
	}

	.nav-link.active {
		color: var(--text);
		background: var(--surface-2);
		font-weight: 700;
	}

	.nav-avatar {
		display: inline-flex;
		margin-left: 0.4rem;
	}

	.avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
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

	@media (max-width: 560px) {
		.nav-label {
			display: none;
		}

		.nav-link {
			font-size: 1.05em;
			padding: 0.4em 0.55em;
		}
	}
</style>
