# Decisions taken during the build

Points where the specification left room, or where reality pushed back, with the
call that was made and why. Written so the next person can disagree with the
reasoning rather than guess at it.

---

### The base schema was written from scratch

`life-os-schema-002-web.sql` was supplied, but the migration it extends
(`app_user`, `object`, `edge`, `activity`, `metric`, `model_fact`, `capture`,
`account`, `transaction`, `calendar_event`, `review`, `integration`,
`rollup_progress()` and the activity triggers) was not in the folder.

It has been written to match everything migration 002 and the two specs
reference: the column names, the `notify->'channels'` shape, the `capture.channel`
vocabulary, the `user_settings.ui` defaults, the rollup function name and the
undo-from-activity-log design. `supabase/migrations/0001_core.sql` is the result;
002 is folded into it and reproduced as `0002_rls.sql`.

If the original 001 turns up and differs, that file is the one to reconcile —
everything else reads through Drizzle definitions that mirror it.

### The 45 object types

The specs call for "the 45 rows of `object_type`" without listing them. The list
in `0003_vocabulary.sql` is derived from every type named across the feature
overview and the UX spec, grouped into the nine categories the screens imply:
work (7), goals (2), brain (9), people (3), library (7), interests (2), life (3),
money (5), knowledge (4), health (3).

Adding or renaming one is a migration, not a code change.

### A local dev sign-in bypass exists

The product needs Supabase for auth, but requiring a cloud account before anyone
can see the app run is a bad first five minutes. `LIFEOS_DEV_USER` treats every
request as coming from one account.

It is guarded on `NODE_ENV !== 'production'` in `src/lib/env.ts`, so there is no
configuration that enables it on a deployed instance. The cost is that the E2E
suite runs against the dev server; that trade is documented in
`playwright.config.ts` and `CONTRIBUTING.md`.

### Queries go through Drizzle, not PostgREST

The spec asks for Drizzle and for RLS. Those pull in different directions: a
pooled server-side connection does not carry a user JWT, so `auth.uid()` is null
and RLS cannot be what enforces isolation on the hot path.

The resolution is both. Every query filters by `user_id` in application code —
that is what enforces isolation — and RLS is enabled on every table as the
second line, catching any query that loses its filter and protecting direct
client access. On a plain Postgres the migration installs a compatible
`auth.uid()` stub so the policy text is identical in both environments.

### Extraction is dispatched, never awaited

`POST /api/capture` commits the raw row and returns. When Inngest is configured
the work is queued; otherwise it runs inline but detached from the request.

Two consequences: the sub-100ms budget is met by construction rather than by
optimisation, and an outage at Anthropic cannot lose what someone typed.

### Matching does not require a model

The 0.55/0.25/0.10/0.10 weighting in the spec assumes embeddings. Without an
OpenAI key the weight redistributes to keyword overlap and completion-verb
proximity, and the debrief still works — measurably, on the seeded data, at 0.74
for the intended match.

This is the difference between a product that is unusable without two paid APIs
and one that is merely sharper with them.

### Colour in the interface is checked twice

`npm run design:check` greps the source. `e2e/design.spec.ts` walks the rendered
DOM in a real browser and fails on any computed colour whose channels differ by
more than 12 points outside a chart or a trajectory indicator.

Source-grepping alone survives until the first inline style, and inline styles
are explicitly permitted for dynamic geometry — a progress width, a Gantt offset.
So the browser check is the one that actually holds the line.

### `src/lib/brand.ts` is the one hex exception

Browser `theme-color` metadata is read by the OS before any stylesheet loads,
and email HTML is rendered by clients that strip `<style>` and do not support
custom properties. Neither can reference a variable.

Rather than scatter literals or weaken the lint, both live in one file that
states why, mirrors `tokens.css`, and is the single path the design check skips.

### The what-if engine splits deterministic from open-ended

Compound growth, required monthly contribution, months-to-target and debt
avalanche ordering are in `lib/finance/projections.ts` and unit-tested. The model
handles the framing — what a question implies, which figures it needs, what it
had to assume — and is told never to invent a balance or a rate.

Assumptions it made are surfaced in the result rather than hidden.

### Two ARIA corrections against the visual spec

The UX spec describes Today and the board in terms of rows. `role="row"` is only
valid inside a table, grid or treegrid, and a screen reader reports it as broken
structure elsewhere — so `ObjectRow` is a `listitem` inside a `list`. It looks
identical and reads correctly.

The hover-revealed complete action originally nested the `Checkbox` button
inside an `IconButton`. Nested interactive elements are invalid HTML and were
caught by a component test; the action is now a single button with a check icon.

### Deliberate omissions

- **No offline write queue.** The service worker caches the shell and serves
  stale data; writes require connectivity and show a retry state. Queueing writes
  against a graph with server-side rollup needs conflict resolution that should
  not be designed before anyone has hit the problem.
- **RRULE is partial** — `FREQ`, `INTERVAL`, `BYDAY`. That covers what people
  write. A full RFC 5545 parser is a dependency, not a feature.
- **Lists are not virtualised.** Off-screen board columns and timeline months use
  `content-visibility: auto`; queries cap at 200 rows. A virtualiser earns its
  place somewhere past a thousand rows in one view, and not before.
- **Microsoft Graph and CalDAV are configured but not implemented.** The
  integration table, the token encryption and the sync-job shape are all generic
  over `kind`; Google is the one wired end to end.
