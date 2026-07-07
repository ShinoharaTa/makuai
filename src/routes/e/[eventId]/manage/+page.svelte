<script lang="ts">
	import { enhance } from '$app/forms';
	import SectionTitle from '$lib/components/SectionTitle.svelte';
	import StatusChip from '$lib/components/StatusChip.svelte';
	import { withConfirm } from '$lib/confirm';
	import { formatSlot } from '$lib/format';

	let { data, form } = $props();

	const isSuspended = $derived(data.event.status === 'suspended');
	const confirmedSlot = $derived(
		data.event.confirmedSlotId
			? (data.detail.slots.find((s) => s.id === data.event.confirmedSlotId) ?? null)
			: null
	);
</script>

<svelte:head>
	<title>主催者メニュー — {data.event.title} — 幕間 makuai</title>
</svelte:head>

<p><a href="/e/{data.event.id}">← 調整ページへ戻る</a></p>

<div class="event-head">
	<h1>主催者メニュー</h1>
	<StatusChip status={data.event.status} />
</div>
<p class="muted">{data.event.title}</p>

{#if form?.message}
	<p class="error-note">{form.message}</p>
{/if}

<SectionTitle>募集ステータス</SectionTitle>
<div class="card status-card">
	{#if isSuspended}
		<p class="muted">募集停止中(回答は一時ストップ)。候補の日時変更はこの間に。終わったら再開しましょう。</p>
		<form method="POST" action="?/reopen" use:enhance>
			<button class="btn btn-primary">▶ 募集を再開する</button>
		</form>
	{:else}
		<p class="muted">
			回答を受付中です。回答を一時的に止めたいとき・候補の日時を変更したいときは「募集停止」にします(いつでも再開できます)。
		</p>
		<form method="POST" action="?/suspend" use:enhance>
			<button class="btn">⏸ 募集停止にする</button>
		</form>
	{/if}
</div>

<SectionTitle>日程の確定</SectionTitle>
<div class="card">
	{#if confirmedSlot}
		<p class="confirmed-line">
			🎫 現在 <strong>{formatSlot(confirmedSlot)}</strong> で確定しています。
		</p>
		<p class="muted">確定後も回答の受付は続きます。別の候補に変えるには下から選び直してください。</p>
		<form
			method="POST"
			action="?/unconfirm"
			use:enhance={withConfirm('確定を解除します。よろしいですか?')}
		>
			<button class="btn btn-sm">確定を解除する</button>
		</form>
	{:else}
		<p class="muted">日程が決まったら候補を選んで確定します。確定しても回答の受付は止まりません。</p>
	{/if}
	<form
		method="POST"
		action="?/confirm"
		use:enhance={withConfirm(
			confirmedSlot
				? '確定する候補を変更します。よろしいですか?'
				: 'この候補で確定します(あとから変更・解除もできます)。よろしいですか?'
		)}
		class="confirm-form"
	>
		{#each data.detail.slots.filter((s) => !s.isCancelled) as slot (slot.id)}
			{@const counts = data.detail.counts[slot.id]}
			<label class="confirm-row">
				<input
					type="radio"
					name="slot_id"
					value={slot.id}
					required
					checked={slot.id === data.event.confirmedSlotId}
				/>
				<span class="confirm-slot">{formatSlot(slot)}</span>
				<span class="count-yes">○{counts.yes}</span>
				<span class="count-maybe">△{counts.maybe}</span>
			</label>
		{/each}
		<button class="btn btn-primary">🎫 {confirmedSlot ? 'この候補に変更する' : 'この候補で確定する'}</button>
	</form>
</div>

<SectionTitle>候補の日時</SectionTitle>
<div class="card slots-card">
	{#if !isSuspended}
		<p class="muted">日時の変更をするには、先に「募集停止」にしてください。追加・中止はいつでもできます。</p>
	{/if}
	{#each data.detail.slots as slot (slot.id)}
		<div class="slot-line" class:cancelled={slot.isCancelled}>
			{#if isSuspended}
				<form method="POST" action="?/updateSlot" use:enhance class="slot-edit-form">
					<input type="hidden" name="slot_id" value={slot.id} />
					<input type="date" name="date" value={slot.date} required aria-label="日付" />
					<input type="time" name="start_time" value={slot.startTime} required aria-label="開始時間" />
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
					{#if slot.id === data.event.confirmedSlotId}🎫{/if}
					{formatSlot(slot)}
					{#if slot.isCancelled}<span class="chip chip-cancelled">中止</span>{/if}
				</span>
			{/if}
			<form
				method="POST"
				action={slot.isCancelled ? '?/restoreSlot' : '?/cancelSlot'}
				use:enhance
			>
				<input type="hidden" name="slot_id" value={slot.id} />
				<button class="btn btn-ghost btn-sm">
					{slot.isCancelled ? '中止を取り消す' : 'この候補を中止'}
				</button>
			</form>
		</div>
	{/each}

	<form method="POST" action="?/addSlot" use:enhance class="slot-add-form">
		<input type="date" name="date" required aria-label="日付" />
		<input type="time" name="start_time" required aria-label="開始時間" />
		<input type="text" name="label" maxlength="30" placeholder="ラベル(昼の部など)" aria-label="ラベル" />
		<button class="btn btn-sm">+ 追加</button>
	</form>
</div>

<SectionTitle>基本情報</SectionTitle>
<form method="POST" action="?/updateInfo" use:enhance>
	<div class="card form-card">
		<label>
			タイトル
			<input type="text" name="title" value={data.event.title} required maxlength="120" />
		</label>
		<label>
			場所
			<input type="text" name="venue" value={data.event.venue ?? ''} maxlength="120" />
		</label>
		<label>
			メモ
			<textarea name="memo" rows="2" maxlength="1000">{data.event.memo ?? ''}</textarea>
		</label>
		<button class="btn" type="submit">保存する</button>
	</div>
</form>

<h2 class="section-title danger-title">危険な操作</h2>
<div class="card danger-card">
	<p class="muted">この調整を削除すると、候補・参加者・回答もすべて消えます(元に戻せません)。</p>
	<form
		method="POST"
		action="?/deleteEvent"
		use:enhance={withConfirm(
			`「${data.event.title}」を削除します。候補・参加者・回答もすべて消え、元に戻せません。よろしいですか?`
		)}
	>
		<button class="btn btn-danger">この調整を削除する</button>
	</form>
</div>

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

	.status-card {
		display: grid;
		gap: 0.6rem;
		justify-items: start;
	}

	.confirmed-line {
		margin: 0;
	}

	.confirm-form {
		display: grid;
		gap: 0.5rem;
		justify-items: start;
		margin-top: 0.8rem;
		border-top: 1px dashed var(--border);
		padding-top: 0.8rem;
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

	.danger-title {
		font-size: 1rem;
		color: var(--accent-soft);
		margin-top: 2rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.4rem;
	}

	.danger-card {
		border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
		display: grid;
		gap: 0.6rem;
		justify-items: start;
	}

	@media (max-width: 560px) {
		.slot-edit-form,
		.slot-add-form {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
