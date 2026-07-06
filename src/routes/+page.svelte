<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { formatSlot } from '$lib/format';

	let { data } = $props();

	const statusLabel = { open: '募集OK', suspended: '募集停止' } as const;
	const markChoices = [
		{ value: 'yes', symbol: '○', label: '行ける' },
		{ value: 'maybe', symbol: '△', label: 'たぶん' },
		{ value: 'no', symbol: '×', label: '無理' }
	] as const;
	const description =
		'幕間(まくあい)は、ライブ・観劇からオフ会・旅行まで使えるみんなの日程調整。候補の日時ごとに、誰が行けるかがひと目でわかります。';

	let submittingId = $state<string | null>(null);
	let quickErrors = $state<Record<string, string>>({});

	// 参加予定: 確定済み(確定日が今日以降)で自分が○の回
	const upcoming = $derived(
		(data.dashboard ?? [])
			.filter((ev) => ev.confirmed && !ev.confirmed.isPast && ev.confirmed.myMark === 'yes')
			.sort((a, b) =>
				`${a.confirmed!.date} ${a.confirmed!.startTime}`.localeCompare(
					`${b.confirmed!.date} ${b.confirmed!.startTime}`
				)
			)
	);

	// 過去のイベント: 確定日を過ぎたもの
	const archived = $derived(
		(data.dashboard ?? [])
			.filter((ev) => ev.confirmed?.isPast)
			.sort((a, b) => `${b.confirmed!.date}`.localeCompare(a.confirmed!.date))
	);

	// 進行中: 上の2つ以外。未回答があるものを先頭に
	const active = $derived(
		(data.dashboard ?? [])
			.filter(
				(ev) =>
					!ev.confirmed?.isPast && !(ev.confirmed && !ev.confirmed.isPast && ev.confirmed.myMark === 'yes')
			)
			.sort((a, b) => {
				const aNeeds = a.status === 'open' && a.unansweredCount > 0 ? 1 : 0;
				const bNeeds = b.status === 'open' && b.unansweredCount > 0 ? 1 : 0;
				if (aNeeds !== bNeeds) return bNeeds - aNeeds;
				return b.createdAt - a.createdAt;
			})
	);
</script>

<svelte:head>
	<title>幕間 makuai — みんなでどの日に行く?</title>
	<meta name="description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="幕間 makuai" />
	<meta property="og:title" content="幕間 makuai — みんなでどの日に行く?" />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={page.url.origin + '/'} />
	<meta property="og:image" content={page.url.origin + '/ogp.png'} />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

{#if !data.user || !data.dashboard}
	<section class="hero">
		<h1>その予定、<br />みんなでどの日に行く?</h1>
		<p class="muted">
			幕間(まくあい)は、ライブ・観劇からオフ会・旅行まで使える日程調整。<br />
			候補の日時ごとに「誰が行けるか」がひと目でわかります。
		</p>
		<a href="/login" class="btn btn-primary">Google ではじめる</a>
	</section>
{:else}
	<section class="dash-head">
		<h1>マイ調整</h1>
		<span class="dash-actions">
			<a href="/groups" class="btn">👥 グループ</a>
			<a href="/events/new" class="btn btn-primary">+ 調整をつくる</a>
		</span>
	</section>

	{#if upcoming.length > 0}
		<h2 class="section-title">🎫 参加予定</h2>
		<ul class="event-list">
			{#each upcoming as ev (ev.id)}
				<li>
					<a href="/e/{ev.id}" class="card event-card upcoming-card">
						<span class="ticket-date">{formatSlot(ev.confirmed!)}</span>
						<span class="event-title">{ev.title}</span>
						{#if ev.venue}<span class="muted">@ {ev.venue}</span>{/if}
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	<h2 class="section-title">進行中の調整</h2>
	{#if active.length > 0}
		<ul class="event-list">
			{#each active as ev (ev.id)}
				{@const needsAnswer = ev.status === 'open' && ev.unansweredCount > 0}
				<li class="card event-block">
					<a href="/e/{ev.id}" class="event-card">
						<span class="event-title">{ev.title}</span>
						{#if ev.venue}<span class="muted">@ {ev.venue}</span>{/if}
						{#if ev.groupName}<span class="chip chip-group">👥 {ev.groupName}</span>{/if}
						{#if ev.confirmed}
							<span class="chip chip-confirmed">🎫 {formatSlot(ev.confirmed)}</span>
						{/if}
						{#if ev.isOwner}<span class="chip chip-owner">主催</span>{/if}
						{#if needsAnswer}
							<span class="chip chip-unanswered">未回答 {ev.unansweredCount}</span>
						{/if}
						<span class="chip chip-{ev.status}">{statusLabel[ev.status]}</span>
					</a>
					{#if needsAnswer}
						<!-- クイック回答: イベントページの answer アクションへそのまま POST -->
						<form
							method="POST"
							action="/e/{ev.id}?/answer"
							class="quick-answer"
							use:enhance={() => {
								submittingId = ev.id;
								return async ({ result }) => {
									submittingId = null;
									if (result.type === 'failure') {
										quickErrors[ev.id] =
											(result.data as { message?: string } | undefined)?.message ??
											'回答できませんでした';
									} else {
										quickErrors[ev.id] = '';
										await invalidateAll();
									}
								};
							}}
						>
							{#if quickErrors[ev.id]}
								<p class="error-note">{quickErrors[ev.id]}</p>
							{/if}
							{#each ev.activeSlots as slot (slot.id)}
								<div class="answer-row">
									<span class="answer-slot" class:unanswered={!ev.myMarks[slot.id]}>
										{formatSlot(slot)}
									</span>
									<div class="mark-group" role="radiogroup" aria-label={formatSlot(slot)}>
										{#each markChoices as choice (choice.value)}
											<label class="mark-choice mark-choice-{choice.value}">
												<input
													type="radio"
													name="slot_{slot.id}"
													value={choice.value}
													checked={ev.myMarks[slot.id] === choice.value}
												/>
												<span>{choice.symbol} {choice.label}</span>
											</label>
										{/each}
									</div>
								</div>
							{/each}
							<button type="submit" class="btn btn-primary btn-sm" disabled={submittingId === ev.id}>
								{submittingId === ev.id ? '送信中…' : 'ここから回答する'}
							</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">進行中の調整はありません。「+ 調整をつくる」か、共有 URL から参加しましょう。</p>
	{/if}

	{#if archived.length > 0}
		<details class="archive">
			<summary class="section-title">過去のイベント({archived.length})</summary>
			<ul class="event-list">
				{#each archived as ev (ev.id)}
					<li>
						<a href="/e/{ev.id}" class="card event-card archived-card">
							<span class="event-title">{ev.title}</span>
							{#if ev.confirmed}
								<span class="muted">🎫 {formatSlot(ev.confirmed)}</span>
							{/if}
							{#if ev.isOwner}<span class="chip chip-owner">主催</span>{/if}
						</a>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
{/if}

<style>
	.hero {
		text-align: center;
		padding: 4rem 0;
	}

	.hero h1 {
		font-size: 2rem;
		letter-spacing: 0.04em;
	}

	.hero p {
		margin: 1.2rem 0 2rem;
	}

	.dash-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.dash-actions {
		display: flex;
		gap: 0.6rem;
	}

	.section-title {
		font-size: 1rem;
		color: var(--text-dim);
		margin-top: 2rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.4rem;
	}

	.event-list {
		list-style: none;
		margin: 0.8rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.7rem;
	}

	.event-card {
		display: flex;
		align-items: center;
		gap: 0.8em;
		padding: 0.9rem 1.2rem;
		color: var(--text);
		flex-wrap: wrap;
	}

	a.event-card:hover {
		text-decoration: none;
		border-color: var(--accent);
	}

	.event-block {
		padding: 0;
		overflow: hidden;
	}

	.event-block .event-card {
		border: none;
	}

	.event-title {
		font-weight: 700;
		flex: 1;
		min-width: 8em;
	}

	.upcoming-card {
		border-color: var(--gold);
	}

	.ticket-date {
		color: var(--gold);
		font-weight: 700;
		white-space: nowrap;
	}

	.archived-card {
		opacity: 0.75;
	}

	.chip-owner {
		background: color-mix(in srgb, var(--accent) 16%, transparent);
		color: var(--accent-soft);
	}

	.chip-confirmed {
		background: color-mix(in srgb, var(--gold) 16%, transparent);
		color: var(--gold);
	}

	.chip-group {
		background: color-mix(in srgb, var(--yes) 12%, transparent);
		color: var(--yes);
	}

	.chip-unanswered {
		background: var(--accent);
		color: #fff;
	}

	.archive {
		margin-top: 1rem;
	}

	.archive summary {
		cursor: pointer;
		list-style: revert;
	}

	/* クイック回答 */
	.quick-answer {
		border-top: 1px dashed var(--border);
		padding: 0.9rem 1.2rem;
		display: grid;
		gap: 0.7rem;
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

	.answer-slot.unanswered::after {
		content: ' •';
		color: var(--accent);
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

	@media (max-width: 560px) {
		.answer-row {
			flex-direction: column;
			align-items: stretch;
			gap: 0.4rem;
		}

		.mark-group {
			display: grid;
			grid-template-columns: 1fr 1fr 1fr;
			gap: 0.4rem;
		}

		.mark-choice span {
			display: block;
			text-align: center;
			padding: 0.65em 0.4em;
			font-size: 1em;
		}
	}
</style>
