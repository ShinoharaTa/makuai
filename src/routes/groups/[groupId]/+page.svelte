<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import SectionTitle from '$lib/components/SectionTitle.svelte';
	import StatusChip from '$lib/components/StatusChip.svelte';
	import { withConfirm } from '$lib/confirm';

	let { data, form } = $props();

	let copiedInvite = $state<string | null>(null);

	async function copyInviteUrl(inviteId: string) {
		await navigator.clipboard.writeText(`${page.url.origin}/g/${inviteId}`);
		copiedInvite = inviteId;
		setTimeout(() => (copiedInvite = null), 2000);
	}
</script>

<svelte:head>
	<title>{data.group.name} — 幕間 makuai</title>
</svelte:head>

<p><a href="/groups">← グループ一覧へ</a></p>

<div class="group-head">
	<h1>👥 {data.group.name}</h1>
	{#if data.role === 'admin'}<span class="chip chip-owner">管理者</span>{/if}
</div>

{#if form?.message}
	<p class="error-note">{form.message}</p>
{/if}

<SectionTitle>このグループの調整</SectionTitle>
{#if data.events.length > 0}
	<ul class="event-list">
		{#each data.events as ev (ev.id)}
			<li>
				<a href="/e/{ev.id}" class="card event-card">
					<span class="event-title">{ev.title}</span>
					{#if ev.venue}<span class="muted">@ {ev.venue}</span>{/if}
					<StatusChip status={ev.status} />
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<p class="muted">まだありません。「調整をつくる」でこのグループを選ぶと、メンバー全員のダッシュボードに届きます。</p>
{/if}
<p><a href="/events/new?group={data.group.id}" class="btn btn-sm">+ このグループで調整をつくる</a></p>

{#if data.role === 'admin' && data.members && data.invites}
	<SectionTitle>メンバー(管理者にのみ表示されます)</SectionTitle>
	<ul class="member-list">
		{#each data.members as m (m.id)}
			<li class="card member-card">
				<span class="member-name">{m.name}</span>
				{#if m.role === 'admin'}<span class="chip chip-owner">管理者</span>{/if}
				<form
					method="POST"
					action="?/removeMember"
					use:enhance={withConfirm(`${m.name} さんをグループから外します。よろしいですか?`)}
				>
					<input type="hidden" name="member_id" value={m.id} />
					<button class="btn btn-ghost btn-sm">外す</button>
				</form>
			</li>
		{/each}
	</ul>

	<SectionTitle>招待</SectionTitle>
	<div class="card invite-card">
		<p class="muted">
			招待 URL を知っている人だけがグループに参加できます。不要になったら無効化してください。
		</p>
		{#each data.invites as invite (invite.id)}
			<div class="invite-row">
				<code class="invite-url">{page.url.origin}/g/{invite.id}</code>
				<button class="btn btn-sm" onclick={() => copyInviteUrl(invite.id)}>
					{copiedInvite === invite.id ? 'コピーしました!' : 'コピー'}
				</button>
				<form method="POST" action="?/revokeInvite" use:enhance>
					<input type="hidden" name="invite_id" value={invite.id} />
					<button class="btn btn-ghost btn-sm">無効化</button>
				</form>
			</div>
		{/each}
		<form method="POST" action="?/createInvite" use:enhance>
			<button class="btn">+ 招待 URL を発行</button>
		</form>
	</div>

	<SectionTitle>グループ設定</SectionTitle>
	<form method="POST" action="?/rename" use:enhance>
		<div class="card rename-card">
			<input type="text" name="name" value={data.group.name} required maxlength="60" />
			<button class="btn">名前を変更</button>
		</div>
	</form>
{/if}

<div class="bottom-actions">
	{#if data.isOwner}
		<form
			method="POST"
			action="?/deleteGroup"
			use:enhance={withConfirm(
				`グループ「${data.group.name}」を削除します。紐づく調整は単発の調整として残ります。よろしいですか?`
			)}
		>
			<button class="btn btn-danger">グループを削除する</button>
		</form>
	{:else}
		<form
			method="POST"
			action="?/leave"
			use:enhance={withConfirm('このグループから退出します。よろしいですか?')}
		>
			<button class="btn btn-ghost btn-sm">グループから退出する</button>
		</form>
	{/if}
</div>

<style>
	.group-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.group-head h1 {
		margin: 0;
	}

	.event-list,
	.member-list {
		list-style: none;
		margin: 0.8rem 0;
		padding: 0;
		display: grid;
		gap: 0.6rem;
	}

	.event-card {
		display: flex;
		align-items: center;
		gap: 0.8em;
		padding: 0.9rem 1.2rem;
		color: var(--text);
		flex-wrap: wrap;
	}

	.event-card:hover {
		text-decoration: none;
		border-color: var(--accent);
	}

	.event-title {
		font-weight: 700;
		flex: 1;
	}

	.member-card {
		display: flex;
		align-items: center;
		gap: 0.8em;
		padding: 0.6rem 1.1rem;
	}

	.member-name {
		font-weight: 600;
		flex: 1;
	}

	.invite-card {
		display: grid;
		gap: 0.7rem;
		justify-items: start;
		margin-top: 0.8rem;
	}

	.invite-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		width: 100%;
	}

	.invite-url {
		background: var(--surface-2);
		padding: 0.3em 0.6em;
		border-radius: 6px;
		font-size: 0.8em;
		overflow-wrap: anywhere;
	}

	.rename-card {
		display: flex;
		gap: 0.6rem;
		margin-top: 0.8rem;
		align-items: center;
	}

	.rename-card input {
		flex: 1;
		max-width: 320px;
	}

	.bottom-actions {
		margin-top: 2.5rem;
		padding-top: 1rem;
		border-top: 1px dashed var(--border);
		display: flex;
		justify-content: flex-end;
	}
</style>
