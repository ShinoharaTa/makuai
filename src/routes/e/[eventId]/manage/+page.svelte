<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatSlot } from '$lib/format';

	let { data, form } = $props();

	const statusLabel = { open: '募集中', suspended: '募集停止', closed: '募集終了' } as const;

	const isOpen = $derived(data.event.status === 'open');
	const isSuspended = $derived(data.event.status === 'suspended');
	const isClosed = $derived(data.event.status === 'closed');

	function confirmClose(e: SubmitEvent) {
		if (
			!confirm(
				'募集終了にすると、以後いっさい回答の追加・変更ができなくなります(元に戻せません)。よろしいですか?'
			)
		) {
			e.preventDefault();
		}
	}

	function confirmSlotConfirm(e: SubmitEvent) {
		if (
			!confirm('この回で確定し、募集を終了します(元に戻せません)。よろしいですか?')
		) {
			e.preventDefault();
		}
	}
</script>

<svelte:head>
	<title>主催者メニュー — {data.event.title} — 幕間 makuai</title>
</svelte:head>

<p><a href="/e/{data.event.id}">← 調整ページへ戻る</a></p>

<div class="event-head">
	<h1>主催者メニュー</h1>
	<span class="chip chip-{data.event.status}">{statusLabel[data.event.status]}</span>
</div>
<p class="muted">{data.event.title}</p>

{#if form?.message}
	<p class="error-note">{form.message}</p>
{/if}

<h2 class="section-title">募集ステータス</h2>
<div class="card status-card">
	{#if isOpen}
		<p class="muted">
			候補の日時を変更する時は、まず「募集停止」にしてください(回答が一時止まります)。回の中止はいつでもできます。
		</p>
		<div class="btn-row">
			<form method="POST" action="?/suspend" use:enhance>
				<button class="btn">🎭 募集停止にする(候補日の調整)</button>
			</form>
			<form method="POST" action="?/close" use:enhance onsubmit={confirmClose}>
				<button class="btn">募集終了にする(確定なし)</button>
			</form>
		</div>
	{:else if isSuspended}
		<p class="muted">募集停止中。候補の編集が終わったら再開しましょう。</p>
		<div class="btn-row">
			<form method="POST" action="?/reopen" use:enhance>
				<button class="btn btn-primary">▶ 募集を再開する</button>
			</form>
			<form method="POST" action="?/close" use:enhance onsubmit={confirmClose}>
				<button class="btn">募集終了にする(確定なし)</button>
			</form>
		</div>
	{:else}
		<p class="muted">この調整は募集終了しています。回答の追加・変更、候補の編集はできません。</p>
	{/if}
</div>

{#if !isClosed}
	<h2 class="section-title">回を確定する</h2>
	<div class="card">
		<p class="muted">確定すると募集終了になり、以後回答は変更できません。</p>
		<form method="POST" action="?/confirm" use:enhance onsubmit={confirmSlotConfirm} class="confirm-form">
			{#each data.detail.slots.filter((s) => !s.isCancelled) as slot (slot.id)}
				{@const counts = data.detail.counts[slot.id]}
				<label class="confirm-row">
					<input type="radio" name="slot_id" value={slot.id} required />
					<span class="confirm-slot">{formatSlot(slot)}</span>
					<span class="count-yes">○{counts.yes}</span>
					<span class="count-maybe">△{counts.maybe}</span>
				</label>
			{/each}
			<button class="btn btn-primary">🎫 この回で確定する</button>
		</form>
	</div>
{/if}

<h2 class="section-title">候補の回</h2>
<div class="card slots-card">
	{#if isOpen}
		<p class="muted">日時の変更をするには、先に「募集停止」にしてください。追加・中止はいつでもできます。</p>
	{/if}
	{#each data.detail.slots as slot (slot.id)}
		<div class="slot-line" class:cancelled={slot.isCancelled}>
			{#if isSuspended}
				<form method="POST" action="?/updateSlot" use:enhance class="slot-edit-form">
					<input type="hidden" name="slot_id" value={slot.id} />
					<input type="date" name="date" value={slot.date} required aria-label="公演日" />
					<input type="time" name="start_time" value={slot.startTime} required aria-label="開演時間" />
					<input
						type="text"
						name="label"
						value={slot.label}
						maxlength="30"
						placeholder="ラベル"
						aria-label="ラベル"
					/>
					<button class="btn btn-sm" disabled={slot.isCancelled}>保存</button>
				</form>
			{:else}
				<span class="slot-text">
					{formatSlot(slot)}
					{#if slot.isCancelled}<span class="chip chip-closed">中止</span>{/if}
				</span>
			{/if}
			{#if !isClosed}
				<form
					method="POST"
					action={slot.isCancelled ? '?/restoreSlot' : '?/cancelSlot'}
					use:enhance
				>
					<input type="hidden" name="slot_id" value={slot.id} />
					<button class="btn btn-ghost btn-sm">
						{slot.isCancelled ? '中止を取り消す' : 'この回を中止'}
					</button>
				</form>
			{/if}
		</div>
	{/each}

	{#if !isClosed}
		<form method="POST" action="?/addSlot" use:enhance class="slot-add-form">
			<input type="date" name="date" required aria-label="公演日" />
			<input type="time" name="start_time" required aria-label="開演時間" />
			<input type="text" name="label" maxlength="30" placeholder="ラベル(昼公演など)" aria-label="ラベル" />
			<button class="btn btn-sm">+ 追加</button>
		</form>
	{/if}
</div>

{#if !isClosed}
	<h2 class="section-title">公演情報</h2>
	<form method="POST" action="?/updateInfo" use:enhance>
		<div class="card form-card">
			<label>
				公演タイトル
				<input type="text" name="title" value={data.event.title} required maxlength="120" />
			</label>
			<label>
				会場
				<input type="text" name="venue" value={data.event.venue ?? ''} maxlength="120" />
			</label>
			<label>
				メモ
				<textarea name="memo" rows="2" maxlength="1000">{data.event.memo ?? ''}</textarea>
			</label>
			<button class="btn" type="submit">保存する</button>
		</div>
	</form>
{/if}

<style>
	.event-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.event-head h1 {
		margin: 0;
	}

	.section-title {
		font-size: 1rem;
		color: var(--text-dim);
		margin-top: 2rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.4rem;
	}

	.status-card {
		display: grid;
		gap: 0.6rem;
	}

	.btn-row {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.confirm-form {
		display: grid;
		gap: 0.5rem;
		justify-items: start;
		margin-top: 0.6rem;
	}

	.confirm-row {
		display: flex;
		align-items: center;
		gap: 0.6em;
		cursor: pointer;
	}

	.confirm-slot {
		font-weight: 600;
	}

	.count-yes {
		color: var(--yes);
		font-weight: 700;
	}

	.count-maybe {
		color: var(--maybe);
	}

	.slots-card {
		display: grid;
		gap: 0.7rem;
	}

	.slot-line {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.slot-line.cancelled .slot-text {
		text-decoration: line-through;
		color: var(--text-dim);
	}

	.slot-edit-form {
		display: grid;
		grid-template-columns: 10rem 7rem 1fr auto;
		gap: 0.5rem;
		align-items: center;
		flex: 1;
	}

	.slot-add-form {
		display: grid;
		grid-template-columns: 10rem 7rem 1fr auto;
		gap: 0.5rem;
		align-items: center;
		border-top: 1px dashed var(--border);
		padding-top: 0.8rem;
	}

	.form-card {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
		justify-items: start;
	}

	.form-card label {
		display: grid;
		gap: 0.3rem;
		font-weight: 600;
		width: 100%;
	}

	@media (max-width: 560px) {
		.slot-edit-form,
		.slot-add-form {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
