<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<h2 class="section-title">{@render children()}</h2>

<style>
	.section-title {
		font-size: 1rem;
		color: var(--text-dim);
		margin-top: 2rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.4rem;
	}
</style>
