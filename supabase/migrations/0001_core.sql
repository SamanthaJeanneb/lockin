-- ============================================================================
-- LIFE OS — MIGRATION 001: core schema
-- ============================================================================
-- The hybrid graph: typed objects, typed edges between them, an append-only
-- activity log, and a metric history. Everything the product shows is a
-- projection of these five tables.
--
-- Presentation-agnostic by design. A task is a task whether it renders as a
-- board card at 1440px or a list row at 375px.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "vector";
create extension if not exists "btree_gin";


-- ----------------------------------------------------------------------------
-- 1. IDENTITY
-- ----------------------------------------------------------------------------

create table if not exists app_user (
  id                 uuid primary key,          -- mirrors auth.users.id
  email              text not null,
  name               text,
  timezone           text not null default 'UTC',
  identity_statement text,                      -- "Build ambitious things, stay free…"
  onboarded_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists user_settings (
  user_id       uuid primary key references app_user(id) on delete cascade,

  -- Client shell state. Read on mount, written on debounce. Never queried by content.
  ui jsonb not null default '{
    "sidebar_collapsed": false,
    "context_pane_width": 360,
    "density": "comfortable",
    "theme": "system",
    "goal_tree_expanded": [],
    "last_board_lens": "all",
    "table_sorts": {},
    "shortcuts_seen": false
  }',

  notify jsonb not null default '{
    "channels": ["webpush", "email"],
    "morning": "07:30",
    "afternoon": "13:00",
    "evening": "21:00",
    "weekly_review": "sun 18:00",
    "monthly_review": "last 18:00",
    "proactive_per_day": 1,
    "quiet_hours": ["22:30", "07:00"]
  }',

  -- observe | suggest | draft | execute, per capability
  ai jsonb not null default '{
    "permission": "suggest",
    "capabilities": {
      "extract": "execute",
      "categorize": "execute",
      "recommend": "suggest",
      "draft": "draft",
      "schedule": "suggest",
      "reach_out": "draft"
    },
    "voice_samples": [],
    "finance_in_prompts": false
  }',

  privacy jsonb not null default '{"journal_in_prompts": true, "share_annual": false}',

  -- Stated area priority for the drift comparison: ["career","finance",…]
  area_priority text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- 2. VOCABULARY
-- ----------------------------------------------------------------------------
-- object_type is global and read-only to users. It is injected into every AI
-- prompt so the vocabulary can grow without a code change.

create table if not exists object_type (
  key             text primary key,
  label           text not null,
  plural          text not null,
  category        text not null,   -- work goals brain people library life money health knowledge
  icon            text not null,   -- lucide-react icon name
  surface         text,            -- the route this type lives on
  default_status  text,
  statuses        text[] not null default '{}',
  is_completable  boolean not null default false,
  has_progress    boolean not null default false,
  has_schedule    boolean not null default false,
  description     text,
  position        smallint not null default 0
);

create table if not exists life_area (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references app_user(id) on delete cascade,
  key       text not null,
  label     text not null,
  series    smallint not null default 1,   -- which chart series token represents it
  position  smallint not null default 0,
  priority  smallint,                      -- stated rank, drives the drift comparison
  archived  boolean not null default false,
  unique (user_id, key)
);

create index if not exists life_area_user on life_area (user_id, position);


-- ----------------------------------------------------------------------------
-- 3. THE GRAPH
-- ----------------------------------------------------------------------------

create table if not exists object (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references app_user(id) on delete cascade,
  type              text not null references object_type(key),
  title             text not null,
  body              text,

  status            text,
  area              text,
  horizon           text,             -- 10y 5y 3y 1y 3m 1m 1w
  priority          smallint,         -- 1 highest … 4 lowest

  progress          numeric(5,2) not null default 0,   -- 0–100, rolled up
  target_value      numeric,
  current_value     numeric,
  unit              text,
  metric_name       text,

  start_at          timestamptz,
  due_at            timestamptz,
  completed_at      timestamptz,
  snooze_until      timestamptz,
  scheduled_start   timestamptz,
  scheduled_end     timestamptz,
  estimate_minutes  integer,
  energy            text,             -- focus admin social physical creative
  rrule             text,             -- RFC 5545 recurrence

  props             jsonb not null default '{}',
  confidence        numeric(3,2),
  inferred_fields   text[] not null default '{}',   -- fields the AI filled, unconfirmed
  source_capture_id uuid,

  embedding         vector(1536),
  position          double precision not null default 0,

  archived_at       timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) stored
);

create index if not exists object_user_type   on object (user_id, type) where deleted_at is null;
create index if not exists object_user_status on object (user_id, status) where deleted_at is null;
create index if not exists object_user_area   on object (user_id, area) where deleted_at is null;
create index if not exists object_user_due    on object (user_id, due_at) where deleted_at is null and completed_at is null;
create index if not exists object_user_horizon on object (user_id, horizon) where deleted_at is null;
create index if not exists object_completed   on object (user_id, completed_at desc) where completed_at is not null;
create index if not exists object_search      on object using gin (search);
create index if not exists object_title_trgm  on object using gin (title gin_trgm_ops);
create index if not exists object_props       on object using gin (props jsonb_path_ops);
create index if not exists object_embedding   on object using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists edge (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app_user(id) on delete cascade,
  from_id     uuid not null references object(id) on delete cascade,
  to_id       uuid not null references object(id) on delete cascade,
  rel         text not null,   -- supports part_of blocks with about recommended_by
                               -- mentions related attended references child_of source_of
  weight      numeric(4,2) not null default 1,
  confidence  numeric(3,2),
  props       jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  unique (from_id, to_id, rel)
);

create index if not exists edge_from on edge (from_id, rel);
create index if not exists edge_to   on edge (to_id, rel);
create index if not exists edge_user on edge (user_id, rel);


-- ----------------------------------------------------------------------------
-- 4. HISTORY
-- ----------------------------------------------------------------------------
-- activity is the source of truth for the timeline, drift, reviews and undo.

create table if not exists activity (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app_user(id) on delete cascade,
  object_id   uuid references object(id) on delete cascade,
  verb        text not null,   -- created updated completed uncompleted snoozed deleted
                               -- restored linked unlinked status_changed progress logged
  actor       text not null default 'user',   -- user ai system integration
  from_value  jsonb,
  to_value    jsonb,
  minutes     integer,         -- effort attribution for the drift chart
  area        text,
  capture_id  uuid,
  at          timestamptz not null default now()
);

create index if not exists activity_user_at   on activity (user_id, at desc);
create index if not exists activity_object    on activity (object_id, at desc);
create index if not exists activity_user_verb on activity (user_id, verb, at desc);

create table if not exists metric (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references app_user(id) on delete cascade,
  object_id  uuid references object(id) on delete cascade,
  key        text not null,   -- progress area_progress habit net_worth savings_rate …
  area       text,
  value      numeric not null,
  unit       text,
  at         timestamptz not null default now(),
  meta       jsonb not null default '{}'
);

create index if not exists metric_user_key on metric (user_id, key, at desc);
create index if not exists metric_object   on metric (object_id, key, at desc);

create table if not exists model_fact (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app_user(id) on delete cascade,
  category      text not null,   -- patterns preferences values skills context relationships
  statement     text not null,
  confidence    numeric(3,2) not null default 0.5,
  status        text not null default 'active',  -- active confirmed wrong changed private forgotten
  evidence      jsonb not null default '[]',     -- [{object_id, kind, note, at}]
  source_count  smallint not null default 1,
  embedding     vector(1536),
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists model_fact_user on model_fact (user_id, category)
  where status not in ('forgotten', 'wrong');


-- ----------------------------------------------------------------------------
-- 5. CAPTURE
-- ----------------------------------------------------------------------------

create table if not exists capture (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references app_user(id) on delete cascade,
  channel      text not null default 'app',  -- app debrief sms voice share_target
                                             -- extension email upload paste
  raw_text     text,
  media_url    text,
  transcript   text,
  meta         jsonb not null default '{}',
  extraction   jsonb,          -- the model's proposal, before the user accepts it
  error        text,
  attempts     smallint not null default 0,
  processed_at timestamptz,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists capture_user     on capture (user_id, created_at desc);
create index if not exists capture_unprocessed on capture (created_at) where processed_at is null;

create table if not exists attachment (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references app_user(id) on delete cascade,
  object_id      uuid references object(id) on delete cascade,
  capture_id     uuid references capture(id) on delete set null,
  storage_path   text not null,
  filename       text not null,
  mime           text,
  bytes          bigint,
  extracted_text text,
  created_at     timestamptz not null default now()
);

create index if not exists attachment_object on attachment (object_id);


-- ----------------------------------------------------------------------------
-- 6. INTEGRATIONS AND MONEY
-- ----------------------------------------------------------------------------

create table if not exists integration (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references app_user(id) on delete cascade,
  kind                   text not null,  -- plaid google_calendar microsoft caldav
                                         -- gmail twilio location
  status                 text not null default 'active',  -- active error revoked
  external_id            text,           -- plaid item_id, google account id, …
  access_token_encrypted text,           -- never leaves the server
  refresh_token_encrypted text,
  scopes                 text[],
  cursor                 text,           -- sync cursor / page token
  last_sync_at           timestamptz,
  error                  text,
  meta                   jsonb not null default '{}',
  created_at             timestamptz not null default now(),
  unique (user_id, kind, external_id)
);

create table if not exists account (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references app_user(id) on delete cascade,
  integration_id       uuid references integration(id) on delete set null,
  external_id          text,
  name                 text not null,
  official_name        text,
  institution          text,
  kind                 text not null,     -- depository investment credit loan manual
  subtype              text,
  mask                 text,
  currency             text not null default 'USD',
  balance_current      numeric(14,2),
  balance_available    numeric(14,2),
  balance_limit        numeric(14,2),
  apr                  numeric(6,3),      -- for loans and credit
  minimum_payment      numeric(14,2),
  is_manual            boolean not null default false,
  include_in_net_worth boolean not null default true,
  last_sync_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, integration_id, external_id)
);

create table if not exists "transaction" (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references app_user(id) on delete cascade,
  account_id      uuid references account(id) on delete cascade,
  external_id     text,
  posted_at       date not null,
  amount          numeric(14,2) not null,   -- negative = money out
  merchant        text,
  description     text,
  category        text,
  category_source text not null default 'plaid',  -- plaid ai user
  pending         boolean not null default false,
  is_transfer     boolean not null default false,
  notes           text,
  object_id       uuid references object(id) on delete set null,
  meta            jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  unique (user_id, account_id, external_id)
);

create index if not exists transaction_user_date on "transaction" (user_id, posted_at desc);
create index if not exists transaction_category  on "transaction" (user_id, category, posted_at desc);

create table if not exists recurring_charge (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references app_user(id) on delete cascade,
  account_id        uuid references account(id) on delete set null,
  merchant          text not null,
  amount            numeric(14,2) not null,
  cadence           text not null default 'monthly',  -- weekly monthly quarterly annual
  next_at           date,
  last_charged_at   date,
  status            text not null default 'active',   -- active cancelled paused
  last_mentioned_at timestamptz,      -- cross-referenced against captures
  created_at        timestamptz not null default now(),
  unique (user_id, merchant, amount)
);

create table if not exists scenario (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app_user(id) on delete cascade,
  question    text not null,
  assumptions jsonb not null default '{}',
  result      jsonb not null default '{}',
  is_saved    boolean not null default false,
  created_at  timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- 7. CALENDAR
-- ----------------------------------------------------------------------------

create table if not exists calendar_event (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references app_user(id) on delete cascade,
  integration_id uuid references integration(id) on delete cascade,
  external_id    text,
  calendar_id    text,
  title          text not null,
  description    text,
  location       text,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  all_day        boolean not null default false,
  busy           boolean not null default true,
  attendees      jsonb not null default '[]',
  object_id      uuid references object(id) on delete set null,  -- written back from a task
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, integration_id, external_id)
);

create index if not exists calendar_event_user_window on calendar_event (user_id, starts_at);


-- ----------------------------------------------------------------------------
-- 8. REVIEWS AND NOTIFICATIONS
-- ----------------------------------------------------------------------------

create table if not exists review (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references app_user(id) on delete cascade,
  period       text not null,      -- weekly monthly annual
  period_start date not null,
  period_end   date not null,
  status       text not null default 'generated',  -- generated in_progress complete
  data         jsonb not null default '{}',
  answers      jsonb not null default '{}',
  share_slug   text unique,
  is_public    boolean not null default false,
  generated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, period, period_start)
);

create table if not exists notification (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app_user(id) on delete cascade,
  channel       text not null default 'webpush',  -- webpush email sms inapp
  kind          text not null,                    -- morning afternoon evening weekly
                                                  -- monthly urgent observation
  title         text not null,
  body          text,
  url           text,
  scheduled_for timestamptz not null default now(),
  sent_at       timestamptz,
  read_at       timestamptz,
  dismissed_at  timestamptz,
  meta          jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists notification_due on notification (scheduled_for)
  where sent_at is null;
create index if not exists notification_user on notification (user_id, created_at desc);


-- ----------------------------------------------------------------------------
-- 9. WEB SHELL STATE  (migration 002, folded in)
-- ----------------------------------------------------------------------------

create table if not exists push_subscription (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app_user(id) on delete cascade,
  endpoint      text not null,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  label         text,
  last_used_at  timestamptz,
  failure_count smallint not null default 0,
  created_at    timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscription_user on push_subscription (user_id)
  where failure_count < 5;

create table if not exists saved_view (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references app_user(id) on delete cascade,
  name       text not null,
  surface    text not null,    -- board projects backlog people library timeline transactions
  filters    jsonb not null default '{}',
  sort       jsonb not null default '{}',
  columns    text[],
  is_pinned  boolean not null default false,
  position   smallint,
  created_at timestamptz not null default now(),
  unique (user_id, surface, name)
);

create index if not exists saved_view_user on saved_view (user_id, surface);


-- ----------------------------------------------------------------------------
-- 10. TRIGGERS
-- ----------------------------------------------------------------------------

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['app_user','user_settings','object','account','calendar_event']
  loop
    execute format(
      'drop trigger if exists %I on %I; create trigger %I before update on %I
       for each row execute function touch_updated_at()',
      t || '_touch', t, t || '_touch', t);
  end loop;
end $$;


-- Every meaningful change to an object writes an activity row. This is what
-- undo, the timeline, drift and the reviews all read from.
create or replace function log_object_activity() returns trigger
language plpgsql as $$
declare
  v_minutes integer;
begin
  if tg_op = 'INSERT' then
    insert into activity (user_id, object_id, verb, actor, to_value, area, capture_id)
    values (new.user_id, new.id, 'created',
            case when new.source_capture_id is null then 'user' else 'ai' end,
            jsonb_build_object('type', new.type, 'title', new.title, 'status', new.status),
            new.area, new.source_capture_id);
    return new;
  end if;

  -- Completion
  if new.completed_at is distinct from old.completed_at then
    v_minutes := coalesce(new.estimate_minutes, 30);
    if new.completed_at is not null then
      insert into activity (user_id, object_id, verb, from_value, to_value, minutes, area)
      values (new.user_id, new.id, 'completed', to_jsonb(old.status), to_jsonb(new.status),
              v_minutes, new.area);
    else
      insert into activity (user_id, object_id, verb, from_value, to_value, area)
      values (new.user_id, new.id, 'uncompleted', to_jsonb(old.status), to_jsonb(new.status),
              new.area);
    end if;
    return new;
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    insert into activity (user_id, object_id, verb, area)
    values (new.user_id, new.id,
            case when new.deleted_at is null then 'restored' else 'deleted' end, new.area);
    return new;
  end if;

  if new.snooze_until is distinct from old.snooze_until and new.snooze_until is not null then
    insert into activity (user_id, object_id, verb, from_value, to_value, area)
    values (new.user_id, new.id, 'snoozed', to_jsonb(old.snooze_until),
            to_jsonb(new.snooze_until), new.area);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into activity (user_id, object_id, verb, from_value, to_value, area)
    values (new.user_id, new.id, 'status_changed', to_jsonb(old.status),
            to_jsonb(new.status), new.area);
    return new;
  end if;

  if new.progress is distinct from old.progress then
    insert into activity (user_id, object_id, verb, actor, from_value, to_value, area)
    values (new.user_id, new.id, 'progress', 'system', to_jsonb(old.progress),
            to_jsonb(new.progress), new.area);
    return new;
  end if;

  if new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.due_at is distinct from old.due_at
     or new.priority is distinct from old.priority
     or new.props is distinct from old.props then
    insert into activity (user_id, object_id, verb, area)
    values (new.user_id, new.id, 'updated', new.area);
  end if;

  return new;
end;
$$;

drop trigger if exists object_activity_ins on object;
create trigger object_activity_ins after insert on object
  for each row execute function log_object_activity();

drop trigger if exists object_activity_upd on object;
create trigger object_activity_upd after update on object
  for each row execute function log_object_activity();

create or replace function log_edge_activity() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into activity (user_id, object_id, verb, to_value)
    values (new.user_id, new.from_id, 'linked',
            jsonb_build_object('to', new.to_id, 'rel', new.rel));
    return new;
  end if;

  -- Deleting an object cascade-deletes its edges. Logging "unlinked" against an
  -- object that is disappearing in the same statement would violate the foreign
  -- key, so the row is only written when the subject still exists. The object's
  -- own 'deleted' entry already records what happened.
  if exists (select 1 from object where id = old.from_id) then
    insert into activity (user_id, object_id, verb, from_value)
    values (old.user_id, old.from_id, 'unlinked',
            jsonb_build_object('to', old.to_id, 'rel', old.rel));
  end if;
  return old;
end;
$$;

drop trigger if exists edge_activity_ins on edge;
create trigger edge_activity_ins after insert on edge
  for each row execute function log_edge_activity();

drop trigger if exists edge_activity_del on edge;
create trigger edge_activity_del after delete on edge
  for each row execute function log_edge_activity();


-- ----------------------------------------------------------------------------
-- 11. ROLLUP
-- ----------------------------------------------------------------------------
-- Progress flows upward through `part_of` and `supports` edges:
--   task ──part_of──▶ milestone ──part_of──▶ project ──supports──▶ goal ──supports──▶ goal
--
-- A node with children takes the weighted mean of its children. A leaf takes
-- its own metric (current/target) if it has one, else 100 when complete.
-- Recomputed on completion and nightly, snapshotted into `metric`.

create or replace function node_own_progress(p object) returns numeric
language plpgsql immutable as $$
begin
  if p.completed_at is not null then return 100; end if;
  if p.target_value is not null and p.target_value <> 0 then
    return least(100, greatest(0, round((coalesce(p.current_value, 0) / p.target_value) * 100, 2)));
  end if;
  if p.status in ('doing') then return greatest(p.progress, 10); end if;
  return coalesce(p.progress, 0);
end;
$$;

create or replace function rollup_progress(p_user uuid)
returns integer
language plpgsql as $$
declare
  v_pass    integer := 0;
  v_changed integer;
  v_total   integer := 0;
begin
  -- Bottom-up by repeated relaxation. Depth is small (task→milestone→project→
  -- goal→goal→goal), so a bounded number of passes converges.
  loop
    v_pass := v_pass + 1;

    with child_rollup as (
      select e.to_id as parent_id,
             round(sum(o.progress * coalesce(e.weight, 1))
                   / nullif(sum(coalesce(e.weight, 1)), 0), 2) as pct
      from edge e
      join object o on o.id = e.from_id
      where e.user_id = p_user
        and e.rel in ('part_of', 'supports')
        and o.deleted_at is null
        and o.archived_at is null
      group by e.to_id
    )
    update object o
       set progress = c.pct
      from child_rollup c
     where o.id = c.parent_id
       and o.user_id = p_user
       and o.deleted_at is null
       and o.progress is distinct from c.pct;

    get diagnostics v_changed = row_count;
    v_total := v_total + v_changed;
    exit when v_changed = 0 or v_pass >= 8;
  end loop;

  -- Leaves keep their own measure.
  update object o
     set progress = node_own_progress(o)
   where o.user_id = p_user
     and o.deleted_at is null
     and not exists (
       select 1 from edge e join object c on c.id = e.from_id
        where e.to_id = o.id and e.rel in ('part_of', 'supports') and c.deleted_at is null
     )
     and o.progress is distinct from node_own_progress(o);

  -- Snapshot goals and projects so the sparkline has a history.
  insert into metric (user_id, object_id, key, area, value, unit)
  select o.user_id, o.id, 'progress', o.area, o.progress, '%'
    from object o
   where o.user_id = p_user
     and o.type in ('goal', 'project', 'milestone')
     and o.deleted_at is null
     and o.archived_at is null;

  -- And one row per life area, which is what the Home progress strip reads.
  insert into metric (user_id, key, area, value, unit)
  select p_user, 'area_progress', o.area, round(avg(o.progress), 2), '%'
    from object o
   where o.user_id = p_user
     and o.type = 'goal'
     and o.area is not null
     and o.deleted_at is null
     and o.archived_at is null
   group by o.area;

  return v_total;
end;
$$;


-- Recursive goal hierarchy with rolled-up progress and trajectory.
create or replace function goal_tree(p_user uuid)
returns table (
  id uuid, parent_id uuid, depth integer, path uuid[],
  title text, area text, horizon text, progress numeric,
  due_at timestamptz, status text, trajectory text, delta7 numeric
)
language sql stable as $$
  with recursive roots as (
    select o.id, null::uuid as parent_id, 0 as depth, array[o.id] as path
      from object o
     where o.user_id = p_user and o.type = 'goal'
       and o.deleted_at is null and o.archived_at is null
       and not exists (
         select 1 from edge e join object p on p.id = e.to_id
          where e.from_id = o.id and e.rel = 'supports'
            and p.type = 'goal' and p.deleted_at is null)
    union all
    select c.id, r.id, r.depth + 1, r.path || c.id
      from roots r
      join edge e on e.to_id = r.id and e.rel = 'supports'
      join object c on c.id = e.from_id and c.type = 'goal'
     where c.deleted_at is null and c.archived_at is null
       and not c.id = any(r.path)
  )
  select r.id, r.parent_id, r.depth, r.path,
         o.title, o.area, o.horizon, o.progress, o.due_at, o.status,
         case
           when o.due_at is null then 'none'
           when o.completed_at is not null then 'ahead'
           when o.progress >= 100 then 'ahead'
           when o.due_at < now() then 'overdue'
           when o.start_at is not null and o.due_at > o.start_at then
             case
               when o.progress >= (extract(epoch from (now() - o.start_at))
                                   / nullif(extract(epoch from (o.due_at - o.start_at)), 0)) * 100 + 5
                 then 'ahead'
               when o.progress >= (extract(epoch from (now() - o.start_at))
                                   / nullif(extract(epoch from (o.due_at - o.start_at)), 0)) * 100 - 5
                 then 'on_track'
               else 'behind'
             end
           else 'on_track'
         end as trajectory,
         coalesce(o.progress - (
           select m.value from metric m
            where m.object_id = o.id and m.key = 'progress'
              and m.at < now() - interval '7 days'
            order by m.at desc limit 1), 0) as delta7
    from roots r
    join object o on o.id = r.id
   order by r.path;
$$;


-- Effort attribution for the drift view: completed work weighted by estimate,
-- grouped by the area of the goal it ultimately supports.
create or replace function effort_by_area(p_user uuid, p_from timestamptz, p_to timestamptz)
returns table (area text, minutes bigint, items bigint)
language sql stable as $$
  select coalesce(a.area, 'unlinked') as area,
         sum(coalesce(a.minutes, 30))::bigint as minutes,
         count(*)::bigint as items
    from activity a
   where a.user_id = p_user
     and a.verb = 'completed'
     and a.at >= p_from and a.at < p_to
   group by 1
   order by 2 desc;
$$;
