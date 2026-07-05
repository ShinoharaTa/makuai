<script lang="ts">
	let { data } = $props();

	const statusLabel = { open: '募集中', suspended: '募集停止', closed: '募集終了' } as const;
</script>

{#if !data.user}
	<section class="hero">
		<h1>その公演、<br />みんなでどの回に行く?</h1>
		<p class="muted">
			幕間(まくあい)は、観劇・ライブ・推し活のための日程調整。<br />
			公演の回ごとに「誰が行けるか」がひと目でわかります。
		</p>
		<a href="/login" class="btn btn-primary">Google ではじめる</a>
	</section>
{:else}
	<section class="dash-head">
		<h1>マイ調整</h1>
		<a href="/events/new" class="btn btn-primary">+ 調整をつくる</a>
	</section>

	<h2 class="section-title">主催している調整</h2>
	{#if data.hosted && data.hosted.length > 0}
		<ul class="event-list">
			{#each data.hosted as ev (ev.id)}
				<li>
					<a href="/e/{ev.id}" class="card event-card">
						<span class="event-title">{ev.title}</span>
						{#if ev.venue}<span class="muted">@ {ev.venue}</span>{/if}
						<span class="chip chip-{ev.status}">{statusLabel[ev.status]}</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">まだありません。「+ 調整をつくる」から最初の調整を立てましょう。</p>
	{/if}

	<h2 class="section-title">参加している調整</h2>
	{#if data.joined && data.joined.length > 0}
		<ul class="event-list">
			{#each data.joined as ev (ev.id)}
				<li>
					<a href="/e/{ev.id}" class="card event-card">
						<span class="event-title">{ev.title}</span>
						{#if ev.venue}<span class="muted">@ {ev.venue}</span>{/if}
						<span class="chip chip-{ev.status}">{statusLabel[ev.status]}</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">共有 URL を開いて回答すると、ここに表示されます。</p>
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

	.section-title {
		font-size: 1rem;
		color: var(--text-dim);
		margin-top: 2rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.4rem;
	}

	.event-list {
		list-style: none;
		margin: 0;
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
	}

	.event-card:hover {
		text-decoration: none;
		border-color: var(--accent);
	}

	.event-title {
		font-weight: 700;
		flex: 1;
	}
</style>
