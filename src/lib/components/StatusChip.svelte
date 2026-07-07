<script lang="ts">
	import type { EventStatus } from '$lib/server/db/schema';

	let { status }: { status: EventStatus } = $props();

	const statusLabel = { open: '募集OK', suspended: '募集停止' } as const;
</script>

<span class="chip chip-{status}">{statusLabel[status]}</span>
