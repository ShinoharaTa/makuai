<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let slotRows = $state([
		{ date: '', time: '', label: '' },
		{ date: '', time: '', label: '' }
	]);
	let submitting = $state(false);

	function addRow() {
		slotRows.push({ date: '', time: '', label: '' });
	}

	function removeRow(i: number) {
		slotRows.splice(i, 1);
	}
</script>

<h1>調整をつくる</h1>
<p class="muted">イベントの情報と候補の日時を入れて、メンバーに共有 URL を送りましょう。</p>

{#if form?.message}
	<p class="error-note">{form.message}</p>
{/if}

<form
	method="POST"
	action="?/create"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			submitting = false;
			await update();
		};
	}}
>
	<div class="card form-card">
		<label>
			タイトル <span class="req">必須</span>
			<input type="text" name="title" required maxlength="120" placeholder="例: ◯◯のライブ / オフ会 / 温泉旅行" />
		</label>
		<label>
			場所
			<input type="text" name="venue" maxlength="120" placeholder="例: 大阪・梅田" />
		</label>
		<label>
			メモ
			<textarea name="memo" rows="2" maxlength="1000" placeholder="チケット代・集合など、伝えたいことがあれば"></textarea>
		</label>
		{#if data.myGroups.length > 0}
			<label>
				グループに共有(任意)
				<select name="group_id">
					<option value="">共有しない(URL だけで招待)</option>
					{#each data.myGroups as g (g.id)}
						<option value={g.id} selected={g.id === data.preselectedGroupId}>👥 {g.name}</option>
					{/each}
				</select>
				<span class="muted hint">選ぶと、グループメンバー全員のダッシュボードに届きます。URL 招待のゲストも参加できます。</span>
			</label>
		{/if}
	</div>

	<h2 class="slots-title">候補の日時</h2>
	<div class="card form-card">
		{#each slotRows as row, i (row)}
			<div class="slot-row">
				<input type="date" name="slot_date" bind:value={row.date} aria-label="日付" />
				<input type="time" name="slot_time" bind:value={row.time} aria-label="開始時間" />
				<input
					type="text"
					name="slot_label"
					bind:value={row.label}
					maxlength="30"
					placeholder="昼の部・夜の部 など"
					aria-label="ラベル"
				/>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={() => removeRow(i)}
					disabled={slotRows.length <= 1}
					aria-label="この候補を削除"
				>
					✕
				</button>
			</div>
		{/each}
		<button type="button" class="btn btn-sm" onclick={addRow}>+ 候補を追加</button>
	</div>

	<div class="submit-row">
		<button type="submit" class="btn btn-primary" disabled={submitting}>
			{submitting ? '作成中…' : 'この内容で作成する'}
		</button>
	</div>
</form>

<style>
	.form-card {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
	}

	label {
		display: grid;
		gap: 0.3rem;
		font-weight: 600;
	}

	.req {
		color: var(--accent-soft);
		font-size: 0.75em;
		margin-left: 0.4em;
	}

	select {
		padding: 0.6em 0.8em;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface-2);
		color: var(--text);
	}

	.hint {
		font-weight: 400;
		font-size: 0.8em;
	}

	.slots-title {
		margin: 1.6rem 0 0;
		font-size: 1.05rem;
	}

	.slot-row {
		display: grid;
		grid-template-columns: 10rem 7rem 1fr auto;
		gap: 0.5rem;
		align-items: center;
	}

	.submit-row {
		margin-top: 1.5rem;
		text-align: center;
	}

	@media (max-width: 560px) {
		.slot-row {
			grid-template-columns: 1fr 1fr;
		}

		.slot-row input[name='slot_label'] {
			grid-column: 1 / 2;
		}
	}
</style>
