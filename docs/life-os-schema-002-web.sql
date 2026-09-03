-- ============================================================================
-- LIFE OS — MIGRATION 002: web application additions
-- ============================================================================
--
-- Context: the product moved from "mobile-first app" to "responsive web
-- application." The core data model is unchanged — object, edge, activity,
-- metric, model_fact, account, transaction, calendar_event, review, and
-- integration are all presentation-agnostic and need no modification.
--
-- Three things genuinely differ in a browser:
--
--   1. Push notifications use the Web Push protocol (endpoint + two keys),
--      not an APNs/FCM device token. Needs its own table.
--   2. A desktop app has meaningful per-user UI state — pane widths, sidebar
--      collapse, tree expansion, density — that should survive a reload and
--      follow the user between machines. Server-side, not localStorage.
--   3. Desktop users build and reuse filtered views (board lenses, table
--      sorts). Worth a small table.
--
-- Everything else stays exactly as it was.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. WEB PUSH SUBSCRIPTIONS
-- ----------------------------------------------------------------------------
-- Web Push is per-browser, not per-user: the same person may have Chrome on a
-- desktop, Firefox on a laptop, and an installed PWA on Android, each with a
-- distinct endpoint. All of them should receive the morning brief.
--
-- Note: iOS Safari only permits push for PWAs added to the home screen, and
-- support is inconsistent. The notification scheduler must fall back to email
-- (Resend) when a user has no live subscription — this is why the fallback is
-- part of the design rather than an afterthought.
-- ----------------------------------------------------------------------------

create table push_subscription (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app_user(id) on delete cascade,
  endpoint      text not null,
  p256dh        text not null,               -- client public key
  auth          text not null,               -- client auth secret
  user_agent    text,                        -- for the settings list: "Chrome on macOS"
  label         text,                        -- user-editable: "Work laptop"
  last_used_at  timestamptz,
  failure_count smallint not null default 0, -- prune at 5 consecutive 410/404
  created_at    timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index push_subscription_user on push_subscription (user_id)
  where failure_count < 5;

alter table push_subscription enable row level security;


-- ----------------------------------------------------------------------------
-- 2. PERSISTED UI STATE
-- ----------------------------------------------------------------------------
-- The three-pane shell has state worth keeping: how wide you dragged the
-- context pane, whether the sidebar is collapsed, which goal-tree branches are
-- open, which board lens you were last using.
--
-- localStorage would work but fails the moment you open the app on a second
-- machine, and the goal-tree expansion set in particular is real user intent —
-- it encodes which parts of your life you're currently working on.
--
-- One jsonb column rather than a table: this is read once on shell mount,
-- written on debounce, never queried by its contents.
-- ----------------------------------------------------------------------------

alter table user_settings
  add column ui jsonb not null default '{
    "sidebar_collapsed": false,
    "context_pane_width": 360,
    "density": "comfortable",
    "theme": "system",
    "goal_tree_expanded": [],
    "last_board_lens": "all",
    "table_sorts": {},
    "shortcuts_seen": false
  }';

comment on column user_settings.ui is
  'Client shell state. Read on mount, written on debounce. Never queried by content.';


-- ----------------------------------------------------------------------------
-- 3. SAVED VIEWS
-- ----------------------------------------------------------------------------
-- On a wide screen you build filtered views and want them back: "Career board,"
-- "everything blocked," "projects due this quarter sorted by load."
--
-- A saved view is just a named filter over the existing object/edge tables. It
-- creates no new data and duplicates nothing — same underlying set, different
-- lens, which is the principle the board already follows.
-- ----------------------------------------------------------------------------

create table saved_view (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app_user(id) on delete cascade,
  name        text not null,
  surface     text not null,                 -- board | projects | backlog | people |
                                             -- library | timeline | transactions
  filters     jsonb not null default '{}',   -- {"area":"career","status":["today","doing"],
                                             --  "goal_id":"...","blocked":true}
  sort        jsonb not null default '{}',   -- {"key":"due_at","dir":"asc"}
  columns     text[],                        -- for table surfaces: visible columns, in order
  is_pinned   boolean not null default false,-- pinned views appear in the sidebar
  position    smallint,                      -- ordering among pinned views
  created_at  timestamptz not null default now(),
  unique (user_id, surface, name)
);

create index saved_view_user on saved_view (user_id, surface);

alter table saved_view enable row level security;


-- ----------------------------------------------------------------------------
-- 4. VOCABULARY UPDATES (comments only — no structural change)
-- ----------------------------------------------------------------------------
-- capture.channel gains two browser-native entry points:
--   'extension'    — right-click "Save to Life OS" from the browser extension
--   'share_target' — Android PWA share sheet (Web Share Target API)
--
-- notification.channel is now:
--   webpush | email | sms | inapp
-- ('push' becomes 'webpush' to make the protocol explicit; email is the
--  documented fallback for browsers without push support.)
-- ----------------------------------------------------------------------------

comment on column capture.channel is
  'app | debrief | sms | voice | share_target | extension | email | upload | paste';

comment on column notification.channel is
  'webpush | email | sms | inapp';

update notification set channel = 'webpush' where channel = 'push';

update user_settings
  set notify = jsonb_set(notify, '{channels}', '["webpush","email"]')
  where notify->'channels' @> '["push"]';


-- ----------------------------------------------------------------------------
-- 5. RLS POLICIES FOR NEW TABLES
-- ----------------------------------------------------------------------------

create policy own_rows on push_subscription for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy own_rows on saved_view for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ============================================================================
-- WHAT DID NOT CHANGE, AND WHY
-- ============================================================================
--
-- object          Layout-independent. A task is a task whether it renders as a
--                 board card at 1440px or a list row at 375px. The `props`
--                 jsonb already absorbs any new type-specific field without a
--                 migration.
--
-- edge            The graph is the graph. Pane count is irrelevant to it.
--
-- activity        Already the source of truth for timeline, drift, reviews,
--                 and undo. Undo is a 5-second client-side window backed by
--                 this log; nothing about that is platform-specific.
--
-- metric          Progress history. Renders as a sparkline in a 360px context
--                 pane or a full chart on a goal route — same rows.
--
-- model_fact      The personal model, with evidence and confidence. Unchanged.
--
-- account,        Finance is finance. Plaid's flow is a web redirect either
-- transaction,    way; there was never a native SDK dependency here.
-- recurring_charge
--
-- calendar_event  Cache of external calendars. Unchanged.
--
-- review          Weekly, monthly, annual snapshots. Unchanged.
--
-- integration     Already generic over kind. 'location' now means the browser
--                 Geolocation API rather than a native location service, which
--                 is a config difference, not a schema one — and it drops in
--                 priority, since a browser can't wake for background geofences.
--
-- rollup_progress() and the activity triggers are untouched.
--
-- ============================================================================
