<script lang="ts">
	import { enhance } from '$app/forms';
	import { authClient } from '$lib/auth-client';

	let { data, form } = $props();

	const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
	let connecting = $state(false);

	async function connectCalendar() {
		connecting = true;
		await authClient.linkSocial({
			provider: 'google',
			scopes: [data.calendarScope],
			callbackURL: '/settings/rules'
		});
	}
</script>

<svelte:head>
	<title>都合ルール — 幕間 makuai</title>
</svelte:head>

<h1>都合ルール</h1>
<p class="muted">
	「この曜日のこの時間は行けない」を登録しておくと、新しい調整を開いたときに ○× が自動で下書きされます(送信するまで回答にはなりません)。<br />
	ルールの内容はあなたにしか見えず、他のメンバーには ○× しか伝わりません。
</p>

{#if form?.message}
	<p class="error-note">{form.message}</p>
{/if}
{#if form?.success}
	<p class="success-note">反映しました</p>
{/if}

<h2 class="section-title">登録済みのルール</h2>
{#if data.rules.length > 0}
	<ul class="rule-list">
		{#each data.rules as rule (rule.id)}
			<li class="card rule-card">
				<form method="POST" action="?/update" use:enhance class="rule-edit">
					<input type="hidden" name="rule_id" value={rule.id} />
					<span class="rule-prefix">🚫</span>
					<div class="day-row" role="group" aria-label="曜日">
						{#each dayNames as name, i (i)}
							<label class="day-choice" class:weekend={i === 0 || i === 6}>
								<input
									type="checkbox"
									name="day"
									value={i}
									checked={rule.days.split(',').includes(String(i))}
								/>
								<span>{name}</span>
							</label>
						{/each}
					</div>
					<span class="time-pair">
						<input type="time" name="start_time" value={rule.startTime} required aria-label="開始" />
						<span>〜</span>
						<input type="time" name="end_time" value={rule.endTime} required aria-label="終了" />
						<span class="muted">は行けない</span>
					</span>
					<button class="btn btn-sm">保存</button>
				</form>
				<form method="POST" action="?/remove" use:enhance>
					<input type="hidden" name="rule_id" value={rule.id} />
					<button class="btn btn-ghost btn-sm">削除</button>
				</form>
			</li>
		{/each}
	</ul>
{:else}
	<p class="muted">まだありません。よくある例: 平日の 09:00〜18:00(仕事・学校)、毎日 23:00〜23:59(終電)。</p>
{/if}

<h2 class="section-title">Google カレンダー連携(任意)</h2>
<div class="card calendar-card">
	{#if data.calendarConnected}
		<p class="connected">✅ 連携済み。調整を開いたとき、予定が埋まっている候補は × で下書きされます。</p>
		<p class="muted small">
			読み取るのは「空いている / 埋まっている」の時間帯だけで、予定のタイトルや内容は一切取得しません。
			busy かどうかも他のメンバーには伝わりません(伝わるのは送信した ○× のみ)。<br />
			連携をやめるには
			<a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
				Google アカウントのアクセス権設定</a>から makuai の権限を削除してください。
		</p>
	{:else}
		<p class="muted">
			連携すると、調整を開いたときにカレンダーの空き状況も下書きに反映されます。<br />
			読み取るのは「空き / 埋まり」の時間帯のみで、<strong>予定のタイトルや内容は取得すらしません</strong>。
		</p>
		<button class="btn" onclick={connectCalendar} disabled={connecting}>
			{connecting ? 'Google へ移動中…' : 'Google カレンダーと連携する'}
		</button>
	{/if}
</div>

<h2 class="section-title">ルールを追加</h2>
<form method="POST" action="?/add" use:enhance>
	<div class="card add-card">
		<div class="day-row" role="group" aria-label="曜日">
			{#each dayNames as name, i (i)}
				<label class="day-choice" class:weekend={i === 0 || i === 6}>
					<input type="checkbox" name="day" value={i} />
					<span>{name}</span>
				</label>
			{/each}
		</div>
		<div class="time-row">
			<label>
				この時間から
				<input type="time" name="start_time" required />
			</label>
			<span class="tilde">〜</span>
			<label>
				この時間まで
				<input type="time" name="end_time" required />
			</label>
			<span class="muted">は行けない</span>
		</div>
		<button type="submit" class="btn btn-primary">追加する</button>
	</div>
</form>

<style>
	.section-title {
		font-size: 1rem;
		color: var(--text-dim);
		margin-top: 2rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.4rem;
	}

	.rule-list {
		list-style: none;
		margin: 0.8rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.6rem;
	}

	.rule-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 0.7rem 1.1rem;
		flex-wrap: wrap;
	}

	.rule-edit {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		flex: 1;
	}

	.rule-prefix {
		font-size: 1.1em;
	}

	.time-pair {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.success-note {
		background: color-mix(in srgb, var(--yes) 14%, transparent);
		border: 1px solid var(--yes);
		border-radius: 8px;
		padding: 0.6em 1em;
		margin: 0.8em 0;
	}

	.add-card {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
		justify-items: start;
	}

	.calendar-card {
		display: grid;
		gap: 0.6rem;
		margin-top: 1rem;
		justify-items: start;
	}

	.connected {
		margin: 0;
		font-weight: 600;
	}

	.small {
		font-size: 0.85em;
	}

	.day-row {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.day-choice input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.day-choice span {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.4em;
		height: 2.4em;
		border: 1px solid var(--border);
		border-radius: 50%;
		cursor: pointer;
		transition: background 0.12s;
	}

	.day-choice.weekend span {
		color: var(--accent-soft);
	}

	.day-choice input:checked + span {
		background: var(--accent);
		border-color: var(--accent);
		color: #fff;
		font-weight: 700;
	}

	.day-choice input:focus-visible + span {
		outline: 2px solid var(--accent);
	}

	.time-row {
		display: flex;
		align-items: end;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.time-row label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.85em;
		color: var(--text-dim);
	}

	.tilde {
		padding-bottom: 0.5em;
	}

	.time-row .muted {
		padding-bottom: 0.5em;
	}
</style>
