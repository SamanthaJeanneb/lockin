# Architecture notes

Decisions that are not obvious from reading the code, and the reasoning behind
them. The specification of record is in `life-os-build-direction.md`,
`life-os-ux-spec.md` and `DESIGN.md`; this file explains where the
implementation makes a judgement call.

---

## The data model is a hybrid graph, and that is load-bearing

Everything the user creates is a row in `object` with a `type`, and every
relationship is a row in `edge` with a `rel`. There is no `task` table and no
`goal` table.

This is why:

- **Adding a type is a data change.** The 45 rows in `object_type` are injected
  into every extraction prompt, so the model's vocabulary grows without a
  deploy. `ObjectRow` and `ObjectDetail` render any of them.
- **The connections are the product.** An unconnected object is nearly
  worthless — a task you cannot trace to a goal tells you nothing about whether
  your days are moving your years. Putting relationships in their own table
  makes traversal, rollup and the "why this matters" chain one recursive CTE
  each.
- **Rollup is generic.** `task → milestone → project → goal → goal` is four
  different types, but one edge relation (`part_of` / `supports`) and one
  function.

The cost is that type-specific fields live in `props` jsonb rather than typed
columns. That is the right trade at this scale: the fields that every type
shares (title, status, dates, progress) are real columns and are indexed; the
rest are read one object at a time.

## Progress flows upward by relaxation, not recursion

`rollup_progress()` repeatedly takes the weighted mean of each node's children
until nothing changes, capped at eight passes. A recursive CTE would be more
elegant, but the graph is not guaranteed acyclic — a user can link two goals to
each other — and bounded relaxation degrades gracefully where recursion would
either loop forever or need cycle detection on every read.

Leaves keep their own measure: a completed item is 100, an item with a
`target_value` is `current / target`, and anything else keeps what it has.

## Store first, extract second

`POST /api/capture` writes the raw row and returns, then dispatches extraction.
It never awaits a model call.

That ordering is the reason the product is trustworthy. An Anthropic outage, a
rate limit or a malformed response cannot lose what someone typed — the raw text
is already committed, and the extraction is retried against it later. It is also
what makes the sub-100ms acknowledgement achievable at all.

## Matching works without a model

`matchDebrief` scores every open item on four signals — embedding similarity,
keyword overlap, recency, and how close a completion verb sits to the item's own
words. With embeddings configured the weights are 0.55/0.25/0.10/0.10. Without
them, the weight redistributes to keyword overlap and the debrief still works.

This matters more than it looks. It means the core daily loop has no hard
dependency on any paid API, so the product is usable on day one and degrades to
"slightly less sharp" rather than "broken" when a key expires.

The model, when present, refines the scores rather than replacing them: where
the two disagree, the higher score wins.

## The shell owns every viewport decision

Exactly one component knows about panes. Views call `contextPane.open(id)`; the
shell decides whether that means a docked grid column, an overlay drawer, or a
route push.

Without this rule the phone version becomes a second codebase within a month.
With it, `Board`, `GoalTree`, `DataTable` and every detail pane are written once.
`useBreakpoint` uses `matchMedia` rather than resize listeners so it does not
thrash, and renders `standard` on the server so a wide screen never flashes a
narrow layout.

## Colour is a data type, not a decoration

The interface is greyscale. The `data:` tokens are the complete set of chromatic
values in the product and they are permitted on two surfaces: chart series and
progression indicators.

The practical consequence is that interaction states have to be carried by the
surface ladder and ink — hover is `surface-1`, selection is `surface-2`, active
nav is `surface-3` plus a 2px ink rule. The focus ring is 2px ink at 16:1
contrast, which is far more visible than the usual 3:1 blue.

`npm run design:check` fails the build on a hex literal outside `tokens.css`, an
arbitrary Tailwind value, a `dark:` variant, a radius above 8px, or a gradient.
`e2e/design.spec.ts` then checks the rendered result in a real browser, because
a rule that only greps source survives until the first inline style.

`src/lib/brand.ts` is the single documented exception, and it exists because
browser `theme-color` metadata and email HTML are both rendered where CSS custom
properties do not exist.

## RLS is the floor, not the only guard

Every user table has `using (user_id = auth.uid())`, and every query in the
application also filters by `user_id` explicitly.

The application connects through Drizzle over a pooled Postgres connection
rather than through PostgREST, so RLS is not what enforces isolation on the hot
path — the code is. RLS is what catches a query that loses its filter, and what
protects any direct client access. Belt and braces, deliberately.

On a plain Postgres the `0002` migration creates a compatible `auth.uid()` stub,
so the identical policy text works locally and on Supabase.

## Jobs have one implementation and three triggers

Each job in `src/jobs/` is a plain async function. Inngest wraps them when it is
configured; `/api/cron/[job]` calls the same functions when it is not; and
`dispatch()` runs them inline, detached from the request, in development.

Nothing forks. A bug in extraction is one bug, not three.

## Known limitations

- **No offline write queue.** The service worker caches the shell and serves
  stale data, but writes require connectivity and show a retry state. Queuing
  offline writes against a graph with server-side rollup needs conflict
  resolution that is not worth building before anyone has asked for it.
- **RRULE support is partial.** `FREQ`, `INTERVAL` and `BYDAY` only. That covers
  every recurrence people actually write; a full RFC 5545 parser is not
  warranted.
- **Lists are not virtualised.** Off-screen board columns and timeline months use
  `content-visibility: auto`, which the browser handles natively. Tables cap at
  200 rows per fetch. A real virtualiser becomes worth it somewhere past a
  thousand rows in one view.
- **The `what-if` engine asks the model to do arithmetic** against figures it is
  given, rather than computing every scenario in TypeScript. The deterministic
  paths — projections, required contribution, debt payoff — are in
  `lib/finance/projections.ts` and are unit-tested; the model handles the
  open-ended framing. Assumptions it had to make are surfaced in the result.
- **Duplicate detection is per-type.** Two people are compared to each other and
  two books to each other, never a person to a book. That is almost always right
  and much cheaper.
