<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatSlot } from '$lib/format';

	let { data, form } = $props();

	const statusLabel = { open: '募集OK', suspended: '募集停止' } as const;

	const isSuspended = $derived(data.event.status === 'suspended');
	const confirmedSlot = $derived(
		data.event.confirmedSlotId
			? (data.detail.slots.find((s) => s.id === data.event.confirmedSlotId) ?? null)
			: null
	);

	// #13: use:enhance は onsubmit の preventDefault を無視するため、cancel() で止める
	function withConfirm(message: string) {
		return ({ cancel }: { cancel: () => void }) => {
			if (!confirm(message)) {
				cancel();
				return;
			}
			return async ({ update }: { update: () => Promise<void> }) => {
				await update();
			};
		};
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

<h2 class="section-title">日程の確定</h2>
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

<h2 class="section-title">候補の日時</h2>
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

<h2 class="section-title">基本情報</h2>
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

	@media (max-width: 560px) {
		.slot-edit-form,
		.slot-add-form {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
