<script lang="ts">
	import { dismiss, toasts } from '$lib/toast.svelte';
</script>

{#if toasts.length > 0}
	<div class="toasts" aria-live="polite">
		{#each toasts as t (t.id)}
			<button class="toast toast-{t.kind}" onclick={() => dismiss(t.id)} type="button">
				<span>{t.text}</span>
				{#if t.href}
					<a href={t.href} onclick={(e) => e.stopPropagation()}>{t.linkText ?? '開く'}</a>
				{/if}
			</button>
		{/each}
	</div>
{/if}

<style>
	.toasts {
		position: fixed;
		top: 0.8rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		display: grid;
		gap: 0.5rem;
		width: min(92vw, 420px);
	}

	.toast {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 0.7em 1em;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text);
		text-align: left;
		cursor: pointer;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
		font: inherit;
	}

	.toast-success {
		border-color: var(--yes);
	}

	.toast-error {
		border-color: var(--accent);
	}

	.toast a {
		white-space: nowrap;
		font-weight: 700;
	}
</style>
