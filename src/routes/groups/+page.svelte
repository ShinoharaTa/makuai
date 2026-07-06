<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let creating = $state(false);
</script>

<svelte:head>
	<title>グループ — 幕間 makuai</title>
</svelte:head>

<h1>グループ</h1>
<p class="muted">
	いつものメンバーをグループにしておくと、新しい調整を作ったときに全員のダッシュボードへ自動で届きます。
</p>

{#if form?.message}
	<p class="error-note">{form.message}</p>
{/if}

{#if data.groups.length > 0}
	<ul class="group-list">
		{#each data.groups as g (g.id)}
			<li>
				<a href="/groups/{g.id}" class="card group-card">
					<span class="group-name">{g.name}</span>
					{#if g.role === 'admin'}<span class="chip chip-owner">管理者</span>{/if}
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<p class="muted">まだグループがありません。</p>
{/if}

<h2 class="section-title">グループをつくる</h2>
<form
	method="POST"
	action="?/create"
	use:enhance={() => {
		creating = true;
		return async ({ update }) => {
			creating = false;
			await update();
		};
	}}
>
	<div class="card create-card">
		<input type="text" name="name" required maxlength="60" placeholder="例: いつもの遠征メンバー" />
		<button class="btn btn-primary" disabled={creating}>{creating ? '作成中…' : 'つくる'}</button>
	</div>
</form>

<style>
	.group-list {
		list-style: none;
		margin: 0.8rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.7rem;
	}

	.group-card {
		display: flex;
		align-items: center;
		gap: 0.8em;
		padding: 0.9rem 1.2rem;
		color: var(--text);
	}

	.group-card:hover {
		text-decoration: none;
		border-color: var(--accent);
	}

	.group-name {
		font-weight: 700;
		flex: 1;
	}

	.chip-owner {
		background: color-mix(in srgb, var(--accent) 16%, transparent);
		color: var(--accent-soft);
	}

	.section-title {
		font-size: 1rem;
		color: var(--text-dim);
		margin-top: 2rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.4rem;
	}

	.create-card {
		display: flex;
		gap: 0.6rem;
		margin-top: 1rem;
		align-items: center;
	}

	.create-card input {
		flex: 1;
	}
</style>
