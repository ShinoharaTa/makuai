<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';

	let { data, form } = $props();

	let submitting = $state(false);
	let copied = $state(false);

	const statusLabel = { open: '募集中', suspended: '募集停止', closed: '募集終了' } as const;
	const markSymbol = { yes: '○', maybe: '△', no: '×' } as const;
	const markChoices = [
		{ value: 'yes', symbol: '○', label: '行ける' },
		{ value: 'maybe', symbol: '△', label: 'たぶん' },
		{ value: 'no', symbol: '×', label: '無理' }
	] as const;

	const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

	function formatSlot(slot: { date: string; startTime: string; label: string }): string {
		const [y, m, d] = slot.date.split('-').map(Number);
		const wd = weekdays[new Date(y, m - 1, d).getDay()];
		const base = `${m}/${d}(${wd}) ${slot.startTime}`;
		return slot.label ? `${base} ${slot.label}` : base;
	}

	const confirmedSlot = $derived(
		data.event.confirmedSlotId
			? (data.detail.slots.find((s) => s.id === data.event.confirmedSlotId) ?? null)
			: null
	);

	// 最有力スロット: 中止以外で ○ 最多(タイなら △ で比較)。回答ゼロなら強調なし
	const bestSlotId = $derived.by(() => {
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
</svelte:head>

<div class="event-head">
	<div>
		<h1>{data.event.title}</h1>
		<p class="muted">
			{#if data.event.venue}@ {data.event.venue}{/if}
		</p>
	</div>
	<span class="chip chip-{data.event.status}">{statusLabel[data.event.status]}</span>
</div>

{#if data.event.memo}
	<p class="memo card">{data.event.memo}</p>
{/if}

{#if confirmedSlot}
	<div class="confirmed-banner">
		🎫 <strong>{formatSlot(confirmedSlot)}</strong> に決定!当日をお楽しみに。
	</div>
{:else if data.event.status === 'suspended'}
	<div class="notice-banner">🎭 ただいま幕間です。候補日の調整中のため、回答は一時お休み。</div>
{:else if data.event.status === 'closed'}
	<div class="notice-banner">この調整は終演しました(募集終了)。</div>
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

<h2 class="section-title">みんなの回答</h2>
<div class="matrix-wrap">
	<table class="matrix">
		<thead>
			<tr>
				<th class="slot-col">候補の回</th>
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
						{#if slot.isCancelled}<span class="chip chip-closed">中止</span>{/if}
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

<h2 class="section-title">あなたの回答</h2>
{#if data.blockedReason}
	<p class="muted">{data.blockedReason}</p>
{:else}
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
				<div class="answer-row">
					<span class="answer-slot">{formatSlot(slot)}</span>
					<div class="mark-group" role="radiogroup" aria-label={formatSlot(slot)}>
						{#each markChoices as choice (choice.value)}
							<label class="mark-choice mark-choice-{choice.value}">
								<input
									type="radio"
									name="slot_{slot.id}"
									value={choice.value}
									checked={data.myMarks[slot.id] === choice.value}
								/>
								<span>{choice.symbol} {choice.label}</span>
							</label>
						{/each}
					</div>
				</div>
			{/each}
			<button type="submit" class="btn btn-primary" disabled={submitting}>
				{submitting ? '送信中…' : data.hasAnswered ? '回答を更新する' : '参加表明する'}
			</button>
		</div>
	</form>
{/if}

<style>
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

	.success-note {
		background: color-mix(in srgb, var(--yes) 14%, transparent);
		border: 1px solid var(--yes);
		border-radius: 8px;
		padding: 0.6em 1em;
		margin: 0.8em 0;
	}

	.section-title {
		font-size: 1rem;
		color: var(--text-dim);
		margin-top: 2rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.4rem;
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

	.mark-group {
		display: flex;
		gap: 0.4rem;
	}

	.mark-choice input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.mark-choice span {
		display: inline-block;
		padding: 0.3em 0.8em;
		border: 1px solid var(--border);
		border-radius: 999px;
		cursor: pointer;
		font-size: 0.9em;
		transition:
			background 0.12s,
			color 0.12s;
	}

	.mark-choice input:focus-visible + span {
		outline: 2px solid var(--accent);
	}

	.mark-choice-yes input:checked + span {
		background: var(--yes);
		border-color: var(--yes);
		color: #10241d;
		font-weight: 700;
	}

	.mark-choice-maybe input:checked + span {
		background: var(--maybe);
		border-color: var(--maybe);
		color: #2a2010;
		font-weight: 700;
	}

	.mark-choice-no input:checked + span {
		background: var(--no);
		border-color: var(--no);
		color: #17121f;
		font-weight: 700;
	}
</style>
