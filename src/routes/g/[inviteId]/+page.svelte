<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';

	let { data } = $props();

	let joining = $state(false);
</script>

<svelte:head>
	<title>グループへの招待 — 幕間 makuai</title>
</svelte:head>

<section class="join">
	<div class="card join-card">
		<p class="muted">グループへの招待が届いています</p>
		<h1>👥 {data.groupName}</h1>
		{#if data.loggedIn}
			<form
				method="POST"
				action="?/join"
				use:enhance={() => {
					joining = true;
					return async ({ update }) => {
						joining = false;
						await update();
					};
				}}
			>
				<button class="btn btn-primary" disabled={joining}>
					{joining ? '参加中…' : 'このグループに参加する'}
				</button>
			</form>
		{:else}
			<a href="/login?redirectTo={encodeURIComponent(page.url.pathname)}" class="btn btn-primary">
				Google でログインして参加する
			</a>
		{/if}
		<p class="muted small">参加すると、このグループ宛の調整があなたのダッシュボードに届くようになります。</p>
	</div>
</section>

<style>
	.join {
		display: flex;
		justify-content: center;
		padding: 3rem 0;
	}

	.join-card {
		max-width: 440px;
		width: 100%;
		text-align: center;
		display: grid;
		gap: 0.8rem;
		justify-items: center;
		padding: 2.2rem 2rem;
	}

	.join-card h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	.small {
		font-size: 0.8em;
	}
</style>
