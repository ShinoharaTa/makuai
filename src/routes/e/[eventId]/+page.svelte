<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import MarkSelector from '$lib/components/MarkSelector.svelte';
	import SectionTitle from '$lib/components/SectionTitle.svelte';
	import StatusChip from '$lib/components/StatusChip.svelte';
	import { withConfirm } from '$lib/confirm';
	import { formatSlot } from '$lib/format';

	let { data, form } = $props();

	let submitting = $state(false);
	let copied = $state(false);

	const markSymbol = { yes: '○', maybe: '△', no: '×' } as const;

	const ogDescription = $derived(
		data.authed
			? `${data.event.venue ? `@ ${data.event.venue} ` : ''}候補の日時ごとに、誰が行けるかがひと目でわかります。`
			: `${data.event.venue ? `@ ${data.event.venue} ` : ''}候補${data.slotCount}件・${data.participantCount}人が回答中。あなたはいつ行ける?`
	);

	const confirmedSlot = $derived.by(() => {
		if (!data.authed || !data.event.confirmedSlotId) return null;
		return data.detail.slots.find((s) => s.id === data.event.confirmedSlotId) ?? null;
	});

	// 最有力スロット: 中止以外で ○ 最多(タイなら △ で比較)。回答ゼロなら強調なし
	const bestSlotId = $derived.by(() => {
		if (!data.authed) return null;
		let best: string | null = null;
		let bestYes = 0;
		let bestMaybe = 0;
		for (const slot of data.detail.slots) {
			if (slot.isCancelled) continue;
			const c = data.detail.counts[slot.id];
			if (!c || c.yes === 0) continue;
			if (c.yes > bestYes || (c.yes === bestYes && c.maybe > bestMaybe)) {
				best = slot.id;
				bestYes = c.yes;
				bestMaybe = c.maybe;
			}
		}
		return best;
	});

	async function copyShareUrl() {
		await navigator.clipboard.writeText(page.url.origin + `/e/${data.event.id}`);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<svelte:head>
	<title>{data.event.title} — 幕間 makuai</title>
	<meta name="description" content={ogDescription} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="幕間 makuai" />
	<meta property="og:title" content="{data.event.title} — 幕間 makuai" />
	<meta property="og:description" content={ogDescription} />
	<meta property="og:url" content={page.url.origin + `/e/${data.event.id}`} />
	<meta property="og:image" content={page.url.origin + '/ogp.png'} />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

{#if !data.authed}
	<!-- 未ログイン: ティーザー(回答状況・メンバーはログイン後) -->
	<section class="teaser">
		<div class="card teaser-card">
			<StatusChip status={data.event.status} />
			<h1>{data.event.title}</h1>
			{#if data.event.venue}<p class="muted">@ {data.event.venue}</p>{/if}
			<p class="teaser-stats">
				候補 <strong>{data.slotCount}</strong> 件 ・ <strong>{data.participantCount}</strong> 人が回答中
			</p>
			<a href="/login?redirectTo=/e/{data.event.id}" class="btn btn-primary">
				Google でログインして回答する
			</a>
			<p class="muted small">回答にはログインが必要です。みんなの回答もログイン後に見られます。</p>
		</div>
	</section>
{:else}
	<div class="event-head">
		<div>
			<h1>{data.event.title}</h1>
			<p class="muted">
				{#if data.event.venue}@ {data.event.venue}{/if}
				{#if data.group}
					<a href="/groups/{data.group.id}" class="chip chip-group">👥 {data.group.name}</a>
				{/if}
			</p>
		</div>
		<StatusChip status={data.event.status} />
	</div>

	{#if data.event.memo}
		<p class="memo card">{data.event.memo}</p>
	{/if}

	{#if confirmedSlot}
		<div class="confirmed-banner">
			<span>🎫 <strong>{formatSlot(confirmedSlot)}</strong> に決定!当日をお楽しみに。</span>
			<span class="calendar-links">
				<a href="/e/{data.event.id}/calendar.ics" class="btn btn-sm" download>📅 .ics で追加</a>
				<a href={data.googleCalendarUrl} class="btn btn-sm" target="_blank" rel="noopener noreferrer">
					Google カレンダーで開く
				</a>
			</span>
		</div>
	{/if}
	{#if data.event.status === 'suspended'}
		<div class="notice-banner">⏸ ただいま募集停止中。候補の調整が終わるまで、回答は一時お休みです。</div>
	{/if}

	<div class="toolbar">
		<button class="btn btn-sm" onclick={copyShareUrl}>
			{copied ? 'コピーしました!' : '共有 URL をコピー'}
		</button>
		{#if data.isOwner}
			<a href="/e/{data.event.id}/manage" class="btn btn-sm">主催者メニュー</a>
		{/if}
	</div>

	{#if form?.message}
		<p class="error-note">{form.message}</p>
	{/if}
	{#if form?.success}
		<p class="success-note">回答を受け付けました🎟️</p>
	{/if}

	<SectionTitle>みんなの回答</SectionTitle>

	<div class="matrix-wrap">
		<table class="matrix">
			<thead>
				<tr>
					<th class="slot-col">候補の日時</th>
					<th class="count-col">集計</th>
					{#each data.detail.participants as p (p.id)}
						<th class="person-col" title={p.name}>
							{#if p.image}
								<img src={p.image} alt="" class="avatar" referrerpolicy="no-referrer" />
							{/if}
							<span class="person-name">{p.name}</span>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each data.detail.slots as slot (slot.id)}
					{@const counts = data.detail.counts[slot.id]}
					<tr
						class:cancelled={slot.isCancelled}
						class:best={slot.id === bestSlotId && !confirmedSlot}
						class:confirmed={slot.id === data.event.confirmedSlotId}
					>
						<td class="slot-col">
							{#if slot.id === data.event.confirmedSlotId}🎫{/if}
							{formatSlot(slot)}
							{#if slot.isCancelled}<span class="chip chip-cancelled">中止</span>{/if}
						</td>
						<td class="count-col">
							<span class="count-yes">○{counts.yes}</span>
							<span class="count-maybe">△{counts.maybe}</span>
						</td>
						{#each data.detail.participants as p (p.id)}
							{@const mark = data.detail.marks[p.id]?.[slot.id]}
							<td class="mark-cell mark-{mark ?? 'none'}">
								{mark ? markSymbol[mark] : '−'}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
		{#if data.detail.participants.length === 0}
			<p class="muted">まだ誰も回答していません。共有 URL を送って最初の回答を集めましょう。</p>
		{/if}
	</div>

	<SectionTitle>あなたの回答</SectionTitle>
	{#if data.blockedReason}
		<p class="muted">{data.blockedReason}</p>
	{:else}
		{#if Object.keys(data.suggestions).length > 0}
			<p class="suggestion-note">
				✨ あなたの<a href="/settings/rules">都合ルール</a>から未回答分を下書きしました。確認して送信してください。
			</p>
		{/if}
		<form
			method="POST"
			action="?/answer"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					submitting = false;
					await update();
				};
			}}
		>
			<div class="card answer-card">
				{#each data.detail.slots.filter((s) => !s.isCancelled) as slot (slot.id)}
					{@const suggested = !data.myMarks[slot.id] ? data.suggestions[slot.id] : undefined}
					<div class="answer-row" class:suggested={Boolean(suggested)}>
						<span class="answer-slot">
							{formatSlot(slot)}
							{#if suggested}<span class="suggested-tag">✨下書き</span>{/if}
						</span>
						<MarkSelector
							name="slot_{slot.id}"
							value={data.myMarks[slot.id]}
							{suggested}
							includeClear
							label={formatSlot(slot)}
						/>
					</div>
				{/each}
				<label class="display-name">
					この調整での表示名(空欄なら Google の名前)
					<input
						type="text"
						name="display_name"
						value={data.myDisplayName}
						maxlength="30"
						placeholder={data.user?.name ?? ''}
					/>
				</label>
				<button type="submit" class="btn btn-primary" disabled={submitting}>
					{submitting ? '送信中…' : data.hasAnswered ? '回答を更新する' : '参加表明する'}
				</button>
			</div>
		</form>
	{/if}

	{#if data.hasAnswered}
		<div class="leave-row">
			<form
				method="POST"
				action="?/leave"
				use:enhance={withConfirm(
					'この調整から退出します。あなたの回答はすべて消えます。よろしいですか?'
				)}
			>
				<button class="btn btn-ghost btn-sm">この調整から退出する</button>
			</form>
		</div>
	{/if}
{/if}

<style>
	.teaser {
		display: flex;
		justify-content: center;
		padding: 2.5rem 0;
	}

	.teaser-card {
		max-width: 480px;
		width: 100%;
		text-align: center;
		display: grid;
		gap: 0.7rem;
		justify-items: center;
		padding: 2.2rem 2rem;
	}

	.teaser-card h1 {
		margin: 0.2rem 0 0;
		font-size: 1.5rem;
	}

	.teaser-stats strong {
		color: var(--gold);
		font-size: 1.2em;
	}

	.small {
		font-size: 0.8em;
	}

	.event-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.event-head h1 {
		margin: 0 0 0.2rem;
	}

	.memo {
		white-space: pre-wrap;
		padding: 0.8rem 1.2rem;
	}

	.confirmed-banner {
		background: color-mix(in srgb, var(--gold) 16%, transparent);
		border: 1px solid var(--gold);
		border-radius: var(--radius);
		padding: 0.9rem 1.2rem;
		margin: 1rem 0;
		font-size: 1.05em;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		flex-wrap: wrap;
	}

	.calendar-links {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.notice-banner {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.8rem 1.2rem;
		margin: 1rem 0;
		color: var(--text-dim);
	}

	.toolbar {
		display: flex;
		gap: 0.6rem;
		margin: 1rem 0;
		flex-wrap: wrap;
	}

	.matrix-wrap {
		overflow-x: auto;
	}

	.matrix {
		border-collapse: collapse;
		width: 100%;
		min-width: 480px;
	}

	.matrix th,
	.matrix td {
		border: 1px solid var(--border);
		padding: 0.5em 0.7em;
		text-align: center;
		white-space: nowrap;
	}

	.matrix .slot-col {
		text-align: left;
	}

	.person-col .avatar {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		display: block;
		margin: 0 auto 0.15em;
	}

	.person-name {
		font-size: 0.8em;
		font-weight: 600;
		max-width: 6em;
		overflow: hidden;
		text-overflow: ellipsis;
		display: inline-block;
		vertical-align: bottom;
	}

	.count-yes {
		color: var(--yes);
		font-weight: 700;
	}

	.count-maybe {
		color: var(--maybe);
		margin-left: 0.4em;
	}

	.mark-cell {
		font-weight: 700;
		font-size: 1.05em;
	}

	.mark-yes {
		color: var(--yes);
	}

	.mark-maybe {
		color: var(--maybe);
	}

	.mark-no {
		color: var(--no);
	}

	.mark-none {
		color: var(--border);
	}

	tr.best {
		background: color-mix(in srgb, var(--yes) 8%, transparent);
	}

	tr.confirmed {
		background: color-mix(in srgb, var(--gold) 10%, transparent);
	}

	tr.cancelled .slot-col,
	tr.cancelled .mark-cell,
	tr.cancelled .count-col {
		text-decoration: line-through;
		color: var(--text-dim);
	}

	.answer-card {
		display: grid;
		gap: 0.9rem;
		margin-top: 1rem;
		justify-items: start;
	}

	.answer-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		flex-wrap: wrap;
	}

	.answer-slot {
		font-weight: 600;
	}

	.display-name {
		display: grid;
		gap: 0.3rem;
		font-size: 0.85em;
		color: var(--text-dim);
		width: 100%;
		max-width: 340px;
	}

	.suggestion-note {
		background: color-mix(in srgb, var(--gold) 12%, transparent);
		border: 1px solid var(--gold);
		border-radius: 8px;
		padding: 0.6em 1em;
		margin: 0.8em 0 0;
	}

	.suggested-tag {
		font-size: 0.72em;
		color: var(--gold);
		margin-left: 0.4em;
		vertical-align: middle;
	}

	.leave-row {
		margin-top: 2.5rem;
		padding-top: 1rem;
		border-top: 1px dashed var(--border);
		display: flex;
		justify-content: flex-end;
	}

	@media (max-width: 560px) {
		.answer-row {
			flex-direction: column;
			align-items: stretch;
			gap: 0.4rem;
		}
	}
</style>
