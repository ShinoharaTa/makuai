import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
import { user } from './auth-schema';

export * from './auth-schema';

// イベント(調整)ステータス。open ⇄ suspended の2値トグルで、終端状態は持たない。
// open: 募集OK / suspended: 募集停止(回答を一時的に止める。日時変更はこの状態でのみ可)
// 日付の確定(confirmedSlotId)はステータスとは独立した属性。
export const EVENT_STATUSES = ['open', 'suspended'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

// 回答: ○ / △ / ×
export const MARKS = ['yes', 'maybe', 'no'] as const;
export type Mark = (typeof MARKS)[number];

// 常設グループ(#11)。加入は招待経由のみ。
// 誰がメンバーかは管理者のみ閲覧可(UI/クエリ側で強制)。
export const groups = sqliteTable('groups', {
	id: text('id').primaryKey(), // nanoid(21)
	name: text('name').notNull(),
	ownerId: text('owner_id')
		.notNull()
		.references(() => user.id),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
});

export const GROUP_ROLES = ['admin', 'member'] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

export const groupMembers = sqliteTable(
	'group_members',
	{
		id: text('id').primaryKey(),
		groupId: text('group_id')
			.notNull()
			.references(() => groups.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		role: text('role', { enum: GROUP_ROLES }).notNull().default('member'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [
		index('group_members_user_idx').on(table.userId),
		unique('group_members_group_user_uq').on(table.groupId, table.userId)
	]
);

// 招待。id 自体が推測不能トークン(招待 URL /g/<id>)。管理者が発行・無効化する
export const groupInvites = sqliteTable(
	'group_invites',
	{
		id: text('id').primaryKey(), // nanoid(21)
		groupId: text('group_id')
			.notNull()
			.references(() => groups.id, { onDelete: 'cascade' }),
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id),
		revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [index('group_invites_group_idx').on(table.groupId)]
);

export const events = sqliteTable(
	'events',
	{
		// nanoid(21)。推測不能な ID で共有 URL トークンを兼ねる
		id: text('id').primaryKey(),
		ownerId: text('owner_id')
			.notNull()
			.references(() => user.id),
		// 任意のグループ紐づけ。グループ削除時は単発イベントとして残す
		groupId: text('group_id').references(() => groups.id, { onDelete: 'set null' }),
		title: text('title').notNull(),
		venue: text('venue'),
		memo: text('memo'),
		status: text('status', { enum: EVENT_STATUSES }).notNull().default('open'),
		// 確定スロット(NULL = 未確定)。確定してもステータスは変わらず、変更・解除も可能
		confirmedSlotId: text('confirmed_slot_id'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [index('events_owner_idx').on(table.ownerId)]
);

export const slots = sqliteTable(
	'slots',
	{
		id: text('id').primaryKey(),
		eventId: text('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		// 国内イベント前提の JST ナイーブ表記
		date: text('date').notNull(), // 'YYYY-MM-DD'
		startTime: text('start_time').notNull(), // 'HH:MM'
		label: text('label').notNull().default(''), // 例: '昼の部'
		isCancelled: integer('is_cancelled', { mode: 'boolean' }).notNull().default(false),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [
		index('slots_event_idx').on(table.eventId),
		unique('slots_event_datetime_label_uq').on(table.eventId, table.date, table.startTime, table.label)
	]
);

export const participants = sqliteTable(
	'participants',
	{
		id: text('id').primaryKey(),
		eventId: text('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		// この調整内だけの表示名(NULL なら user.name を表示)
		displayName: text('display_name'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [
		index('participants_user_idx').on(table.userId),
		unique('participants_event_user_uq').on(table.eventId, table.userId)
	]
);

// アカウント常設のNGルール(繰り返しの都合)。本人にしか見えない。
// ラベル・メモ類のカラムは意図的に持たない(NG理由を保持しない原則)。
export const ngRules = sqliteTable(
	'ng_rules',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		// 対象曜日。0=日〜6=土 の CSV(例: '1,2,3,4,5' = 平日)
		days: text('days').notNull(),
		startTime: text('start_time').notNull(), // NG 時間帯の開始 'HH:MM'
		endTime: text('end_time').notNull(), // NG 時間帯の終了 'HH:MM'
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [index('ng_rules_user_idx').on(table.userId)]
);

// NG 理由・コメントに類するカラムは仕様として存在させない(REQUIREMENTS のプライバシー原則)
export const answers = sqliteTable(
	'answers',
	{
		id: text('id').primaryKey(),
		participantId: text('participant_id')
			.notNull()
			.references(() => participants.id, { onDelete: 'cascade' }),
		slotId: text('slot_id')
			.notNull()
			.references(() => slots.id, { onDelete: 'cascade' }),
		mark: text('mark', { enum: MARKS }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [
		index('answers_slot_idx').on(table.slotId),
		unique('answers_participant_slot_uq').on(table.participantId, table.slotId)
	]
);
