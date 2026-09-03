/**
 * Drizzle definitions mirroring schema.sql. The SQL file is canonical — this
 * gives the application typed queries over it. Graph traversal and the rollup
 * functions stay in raw SQL because recursive CTEs are clearer that way.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

const now = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const appUser = pgTable('app_user', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  timezone: text('timezone').notNull().default('UTC'),
  identityStatement: text('identity_statement'),
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id').primaryKey(),
  ui: jsonb('ui').notNull().$type<UiState>(),
  notify: jsonb('notify').notNull().$type<Record<string, unknown>>(),
  ai: jsonb('ai').notNull().$type<Record<string, unknown>>(),
  privacy: jsonb('privacy').notNull().$type<Record<string, unknown>>(),
  areaPriority: text('area_priority').array().notNull().default([]),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lifeArea = pgTable(
  'life_area',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    key: text('key').notNull(),
    label: text('label').notNull(),
    series: smallint('series').notNull().default(1),
    position: smallint('position').notNull().default(0),
    priority: smallint('priority'),
    archived: boolean('archived').notNull().default(false),
  },
  (t) => [unique().on(t.userId, t.key)],
);

export const objectType = pgTable('object_type', {
  key: text('key').primaryKey(),
  label: text('label').notNull(),
  plural: text('plural').notNull(),
  category: text('category').notNull(),
  icon: text('icon').notNull(),
  surface: text('surface'),
  defaultStatus: text('default_status'),
  statuses: text('statuses').array().notNull().default([]),
  isCompletable: boolean('is_completable').notNull().default(false),
  hasProgress: boolean('has_progress').notNull().default(false),
  hasSchedule: boolean('has_schedule').notNull().default(false),
  description: text('description'),
  position: smallint('position').notNull().default(0),
});

export const object = pgTable(
  'object',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    status: text('status'),
    area: text('area'),
    horizon: text('horizon'),
    priority: smallint('priority'),
    progress: numeric('progress', { precision: 5, scale: 2 }).notNull().default('0'),
    targetValue: numeric('target_value'),
    currentValue: numeric('current_value'),
    unit: text('unit'),
    metricName: text('metric_name'),
    startAt: timestamp('start_at', { withTimezone: true }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    snoozeUntil: timestamp('snooze_until', { withTimezone: true }),
    scheduledStart: timestamp('scheduled_start', { withTimezone: true }),
    scheduledEnd: timestamp('scheduled_end', { withTimezone: true }),
    estimateMinutes: integer('estimate_minutes'),
    energy: text('energy'),
    rrule: text('rrule'),
    props: jsonb('props').notNull().default(sql`'{}'::jsonb`).$type<Record<string, unknown>>(),
    confidence: numeric('confidence'),
    inferredFields: text('inferred_fields').array().notNull().default([]),
    sourceCaptureId: uuid('source_capture_id'),
    position: doublePrecision('position').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: now(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('object_user_type_ix').on(t.userId, t.type),
    index('object_user_status_ix').on(t.userId, t.status),
  ],
);

export const edge = pgTable(
  'edge',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    fromId: uuid('from_id').notNull(),
    toId: uuid('to_id').notNull(),
    rel: text('rel').notNull(),
    weight: numeric('weight').notNull().default('1'),
    confidence: numeric('confidence'),
    props: jsonb('props').notNull().default(sql`'{}'::jsonb`),
    createdAt: now(),
  },
  (t) => [unique().on(t.fromId, t.toId, t.rel)],
);

export const activity = pgTable('activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  objectId: uuid('object_id'),
  verb: text('verb').notNull(),
  actor: text('actor').notNull().default('user'),
  fromValue: jsonb('from_value'),
  toValue: jsonb('to_value'),
  minutes: integer('minutes'),
  area: text('area'),
  captureId: uuid('capture_id'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

export const metric = pgTable('metric', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  objectId: uuid('object_id'),
  key: text('key').notNull(),
  area: text('area'),
  value: numeric('value').notNull(),
  unit: text('unit'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
});

export const modelFact = pgTable('model_fact', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  category: text('category').notNull(),
  statement: text('statement').notNull(),
  confidence: numeric('confidence').notNull().default('0.5'),
  status: text('status').notNull().default('active'),
  evidence: jsonb('evidence').notNull().default(sql`'[]'::jsonb`).$type<FactEvidence[]>(),
  sourceCount: smallint('source_count').notNull().default(1),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const capture = pgTable('capture', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  channel: text('channel').notNull().default('app'),
  rawText: text('raw_text'),
  mediaUrl: text('media_url'),
  transcript: text('transcript'),
  meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
  extraction: jsonb('extraction').$type<Extraction | null>(),
  error: text('error'),
  attempts: smallint('attempts').notNull().default(0),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: now(),
});

export const attachment = pgTable('attachment', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  objectId: uuid('object_id'),
  captureId: uuid('capture_id'),
  storagePath: text('storage_path').notNull(),
  filename: text('filename').notNull(),
  mime: text('mime'),
  bytes: bigint('bytes', { mode: 'number' }),
  extractedText: text('extracted_text'),
  createdAt: now(),
});

export const integration = pgTable('integration', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  kind: text('kind').notNull(),
  status: text('status').notNull().default('active'),
  externalId: text('external_id'),
  accessTokenEncrypted: text('access_token_encrypted'),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  scopes: text('scopes').array(),
  cursor: text('cursor'),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  error: text('error'),
  meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
  createdAt: now(),
});

export const account = pgTable('account', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  integrationId: uuid('integration_id'),
  externalId: text('external_id'),
  name: text('name').notNull(),
  officialName: text('official_name'),
  institution: text('institution'),
  kind: text('kind').notNull(),
  subtype: text('subtype'),
  mask: text('mask'),
  currency: text('currency').notNull().default('USD'),
  balanceCurrent: numeric('balance_current', { precision: 14, scale: 2 }),
  balanceAvailable: numeric('balance_available', { precision: 14, scale: 2 }),
  balanceLimit: numeric('balance_limit', { precision: 14, scale: 2 }),
  apr: numeric('apr', { precision: 6, scale: 3 }),
  minimumPayment: numeric('minimum_payment', { precision: 14, scale: 2 }),
  isManual: boolean('is_manual').notNull().default(false),
  includeInNetWorth: boolean('include_in_net_worth').notNull().default(true),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const transaction = pgTable('transaction', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  accountId: uuid('account_id'),
  externalId: text('external_id'),
  postedAt: date('posted_at').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  merchant: text('merchant'),
  description: text('description'),
  category: text('category'),
  categorySource: text('category_source').notNull().default('plaid'),
  pending: boolean('pending').notNull().default(false),
  isTransfer: boolean('is_transfer').notNull().default(false),
  notes: text('notes'),
  objectId: uuid('object_id'),
  meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
  createdAt: now(),
});

export const recurringCharge = pgTable('recurring_charge', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  accountId: uuid('account_id'),
  merchant: text('merchant').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  cadence: text('cadence').notNull().default('monthly'),
  nextAt: date('next_at'),
  lastChargedAt: date('last_charged_at'),
  status: text('status').notNull().default('active'),
  lastMentionedAt: timestamp('last_mentioned_at', { withTimezone: true }),
  createdAt: now(),
});

export const scenario = pgTable('scenario', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  question: text('question').notNull(),
  assumptions: jsonb('assumptions').notNull().default(sql`'{}'::jsonb`),
  result: jsonb('result').notNull().default(sql`'{}'::jsonb`),
  isSaved: boolean('is_saved').notNull().default(false),
  createdAt: now(),
});

export const calendarEvent = pgTable('calendar_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  integrationId: uuid('integration_id'),
  externalId: text('external_id'),
  calendarId: text('calendar_id'),
  title: text('title').notNull(),
  description: text('description'),
  location: text('location'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  allDay: boolean('all_day').notNull().default(false),
  busy: boolean('busy').notNull().default(true),
  attendees: jsonb('attendees').notNull().default(sql`'[]'::jsonb`),
  objectId: uuid('object_id'),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const review = pgTable('review', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  period: text('period').notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  status: text('status').notNull().default('generated'),
  data: jsonb('data').notNull().default(sql`'{}'::jsonb`).$type<Record<string, unknown>>(),
  answers: jsonb('answers').notNull().default(sql`'{}'::jsonb`),
  shareSlug: text('share_slug'),
  isPublic: boolean('is_public').notNull().default(false),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const notification = pgTable('notification', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  channel: text('channel').notNull().default('webpush'),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  url: text('url'),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
  dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
  createdAt: now(),
});

export const pushSubscription = pgTable('push_subscription', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  label: text('label'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  failureCount: smallint('failure_count').notNull().default(0),
  createdAt: now(),
});

export const savedView = pgTable('saved_view', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  surface: text('surface').notNull(),
  filters: jsonb('filters').notNull().default(sql`'{}'::jsonb`).$type<Record<string, unknown>>(),
  sort: jsonb('sort').notNull().default(sql`'{}'::jsonb`).$type<Record<string, unknown>>(),
  columns: text('columns').array(),
  isPinned: boolean('is_pinned').notNull().default(false),
  position: smallint('position'),
  createdAt: now(),
});

/* ── Types shared with the client ──────────────────────────────────────────── */

export interface UiState {
  sidebar_collapsed: boolean;
  context_pane_width: number;
  density: 'comfortable' | 'compact';
  theme: 'light' | 'dark' | 'system';
  goal_tree_expanded: string[];
  last_board_lens: string;
  table_sorts: Record<string, { key: string; dir: 'asc' | 'desc' }>;
  shortcuts_seen: boolean;
}

export interface FactEvidence {
  object_id?: string;
  kind: string;
  note: string;
  at: string;
}

export interface ExtractionObject {
  tmp: string;
  type: string;
  title: string;
  props?: Record<string, unknown>;
  area?: string | null;
  status?: string | null;
  due_at?: string | null;
  estimate_minutes?: number | null;
  confidence: number;
  match?: { object_id: string | null; candidates?: { id: string; title?: string; score: number }[] };
}

export interface Extraction {
  objects: ExtractionObject[];
  edges: { from: string; to: string; rel: string; confidence: number }[];
  updates: { object_id: string; set: Record<string, unknown>; confidence: number }[];
  completions: { object_id: string; confidence: number; evidence: string }[];
  not_done: { object_id: string; snooze_to: string }[];
  expenses: { amount: number; merchant: string; category: string; at?: string }[];
  journal: { body: string; mood: string | null; themes: string[] } | null;
  questions: string[];
}

export type ObjectRecord = typeof object.$inferSelect;
export type ObjectInsert = typeof object.$inferInsert;
export type EdgeRecord = typeof edge.$inferSelect;
export type ActivityRecord = typeof activity.$inferSelect;
export type CaptureRecord = typeof capture.$inferSelect;
export type ObjectTypeRecord = typeof objectType.$inferSelect;
export type ModelFactRecord = typeof modelFact.$inferSelect;
export type AccountRecord = typeof account.$inferSelect;
export type TransactionRecord = typeof transaction.$inferSelect;
export type CalendarEventRecord = typeof calendarEvent.$inferSelect;
export type ReviewRecord = typeof review.$inferSelect;
export type LifeAreaRecord = typeof lifeArea.$inferSelect;
export type SavedViewRecord = typeof savedView.$inferSelect;
