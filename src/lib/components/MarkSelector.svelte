<script lang="ts">
	import type { Mark } from '$lib/server/db/schema';

	let {
		name,
		value = undefined,
		suggested = undefined,
		includeClear = false,
		label
	}: {
		/** ラジオグループの name(例: slot_<id>) */
		name: string;
		/** 現在の自分の回答(未回答なら undefined) */
		value?: Mark;
		/** ルール/カレンダー由来の下書き(未回答時のみ有効) */
		suggested?: 'yes' | 'no';
		/** 「−(未回答に戻す)」の選択肢を出すか */
		includeClear?: boolean;
		label: string;
	} = $props();

	const choices = $derived([
		{ value: 'yes', symbol: '○', label: '行ける' },
		{ value: 'maybe', symbol: '△', label: 'たぶん' },
		{ value: 'no', symbol: '×', label: '無理' },
		...(includeClear ? [{ value: 'clear', symbol: '−', label: '未回答' }] : [])
	]);

	function isChecked(choice: string): boolean {
		if (value) return value === choice;
		if (suggested) return suggested === choice;
		return includeClear && choice === 'clear';
	}
</script>

<div class="mark-group" role="radiogroup" aria-label={label}>
	{#each choices as choice (choice.value)}
		<label class="mark-choice mark-choice-{choice.value}">
			<input type="radio" {name} value={choice.value} checked={isChecked(choice.value)} />
			<span>{choice.symbol} {choice.label}</span>
		</label>
	{/each}
</div>

<style>
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

	.mark-choice-clear input:checked + span {
		background: var(--surface-2);
		border-color: var(--text-dim);
		color: var(--text-dim);
		font-weight: 700;
	}

	/* モバイル: タップ領域を広げて等分 */
	@media (max-width: 560px) {
		.mark-group {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
			gap: 0.4rem;
			width: 100%;
		}

		.mark-choice span {
			display: block;
			text-align: center;
			padding: 0.65em 0.4em;
			font-size: 1em;
		}
	}
</style>
