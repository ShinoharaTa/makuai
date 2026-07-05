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

export const events = sqliteTable(
	'events',
	{
		// nanoid(21)。推測不能な ID で共有 URL トークンを兼ねる
		id: text('id').primaryKey(),
		ownerId: text('owner_id')
			.notNull()
			.references(() => user.id),
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
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [
		index('participants_user_idx').on(table.userId),
		unique('participants_event_user_uq').on(table.eventId, table.userId)
	]
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
