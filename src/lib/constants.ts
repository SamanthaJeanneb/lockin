/** Vocabulary shared by the UI, the API and the extraction prompt. */

export const HORIZONS = ['10y', '5y', '3y', '1y', '3m', '1m', '1w'] as const;
export type Horizon = (typeof HORIZONS)[number];

export const HORIZON_LABEL: Record<Horizon, string> = {
  '10y': '10 years',
  '5y': '5 years',
  '3y': '3 years',
  '1y': '1 year',
  '3m': '3 months',
  '1m': '1 month',
  '1w': '1 week',
};

/** Roughly how long a horizon runs, used for trajectory when no start date exists. */
export const HORIZON_DAYS: Record<Horizon, number> = {
  '10y': 3650,
  '5y': 1825,
  '3y': 1095,
  '1y': 365,
  '3m': 91,
  '1m': 30,
  '1w': 7,
};

export const BOARD_COLUMNS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'next', label: 'Next' },
  { key: 'today', label: 'Today' },
  { key: 'doing', label: 'Doing' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'done', label: 'Done' },
] as const;

export type BoardStatus = (typeof BOARD_COLUMNS)[number]['key'];

export const BACKLOG_SECTIONS = [
  { key: 'now', label: 'Now' },
  { key: 'next', label: 'Next' },
  { key: 'later', label: 'Later' },
  { key: 'someday', label: 'Someday' },
  { key: 'maybe', label: 'Maybe' },
] as const;

export const IDEA_STAGES = [
  { key: 'raw', label: 'Raw' },
  { key: 'exploring', label: 'Exploring' },
  { key: 'validating', label: 'Validating' },
  { key: 'building', label: 'Building' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'parked', label: 'Parked' },
] as const;

/** Edge relations. `from` is always the dependent / child / subject. */
export const RELATIONS = [
  'supports', //  goal → goal, project → goal
  'part_of', //   task → milestone, milestone → project
  'blocks', //    task → task
  'with', //      interaction → person, experience → person
  'about', //     note → anything
  'recommended_by', // book → person
  'mentions', //  note → anything (from an @mention)
  'related', //   symmetric, weak
  'attended', //  person → event
  'references', //quote → book
  'source_of', // capture → object
  'evidence_for', // object → model_fact
] as const;
export type Relation = (typeof RELATIONS)[number];

export const RELATION_LABEL: Record<Relation, string> = {
  supports: 'supports',
  part_of: 'part of',
  blocks: 'blocks',
  with: 'with',
  about: 'about',
  recommended_by: 'recommended by',
  mentions: 'mentions',
  related: 'related to',
  attended: 'attended',
  references: 'references',
  source_of: 'source of',
  evidence_for: 'evidence for',
};

export const PRIORITIES = [
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Normal' },
  { value: 4, label: 'Low' },
] as const;

export const ENERGY = ['focus', 'admin', 'social', 'physical', 'creative'] as const;
export type Energy = (typeof ENERGY)[number];

export const TRAJECTORIES = ['ahead', 'on_track', 'behind', 'overdue', 'none'] as const;
export type Trajectory = (typeof TRAJECTORIES)[number];

export const TRAJECTORY_LABEL: Record<Trajectory, string> = {
  ahead: 'Ahead',
  on_track: 'On track',
  behind: 'Behind',
  overdue: 'Overdue',
  none: '—',
};

/** The only place a chromatic value is chosen outside a chart. */
export const TRAJECTORY_VAR: Record<Trajectory, string> = {
  ahead: 'var(--track-ahead)',
  on_track: 'var(--track-on)',
  behind: 'var(--track-behind)',
  overdue: 'var(--track-overdue)',
  none: 'var(--track-none)',
};

export const CAPTURE_CHANNELS = [
  'app',
  'debrief',
  'sms',
  'voice',
  'share_target',
  'extension',
  'email',
  'upload',
  'paste',
] as const;

export const MODEL_FACT_CATEGORIES = [
  { key: 'patterns', label: 'Patterns' },
  { key: 'preferences', label: 'Preferences' },
  { key: 'values', label: 'Values' },
  { key: 'skills', label: 'Skills' },
  { key: 'context', label: 'Context' },
  { key: 'relationships', label: 'Relationships' },
] as const;

export const SPEND_CATEGORIES = [
  'groceries',
  'restaurants',
  'transport',
  'housing',
  'utilities',
  'subscriptions',
  'shopping',
  'health',
  'travel',
  'entertainment',
  'education',
  'gifts',
  'fees',
  'other',
] as const;

export const DEFAULT_AREAS = [
  'career',
  'finance',
  'health',
  'relationships',
  'learning',
  'creative',
  'home',
  'adventure',
] as const;

/** Which area maps to which chart series token. Areas are the only categorical
 *  dimension that recurs across screens, so their series index is fixed. */
export const AREA_SERIES: Record<string, number> = {
  career: 1,
  finance: 2,
  health: 3,
  relationships: 4,
  learning: 5,
  creative: 6,
  home: 7,
  adventure: 8,
  unlinked: 10,
};

export const SNOOZE_OPTIONS = [
  { key: 'later', label: 'Later today', hours: 4 },
  { key: 'tomorrow', label: 'Tomorrow', hours: 24 },
  { key: 'weekend', label: 'This weekend', hours: 0 },
  { key: 'next_week', label: 'Next week', hours: 168 },
  { key: 'someday', label: 'Someday', hours: 0 },
] as const;

export const UNDO_WINDOW_MS = 5000;
