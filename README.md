# LockIn

A personal operating system for the browser.

Capture anything in one field. The AI turns it into structured, connected
objects. The hierarchy shows whether your days are moving your years. Every
evening you write a paragraph and it keeps the whole thing current.

Built for the desktop, on a desk, where you can actually see it — and it works
down to 375px without losing a single capability.

---

## The daily loop

**7:30am.** Open the tab. `G H`. Read Today and the day's periphery in one
screen without scrolling. Maybe `S` to snooze one item. Sixty seconds.

**1:30pm.** Home has shifted to its afternoon state: *"45 minutes free — the
homepage fits."* Thirty seconds.

**9:30pm.** `D`. Type a paragraph about your day. Watch the right column fill in
as you type. Glance at the matches, uncheck nothing, `⌘↵`. *4 of 5 done · Career
+4%.* Two minutes.

Everything else — the goal tree, the twelve-month roadmap, the drift analysis,
the money dashboard — is there when you want to sit down and think, and out of
the way when you don't.

---

## Getting it running

Two commands, if you have Docker:

```bash
npm install
npm run db:up && npm run db:migrate && npm run db:seed
npm run dev
```

That gives you a fully working app at <http://localhost:3000> with realistic
demo data and **no API keys at all**. Capture stores raw text, the debrief
matches on keywords and completion verbs, and Today ranks on deadlines,
dependencies and status.

Add keys to light up the rest. **[SETUP.md](./SETUP.md) is the click-by-click
guide** — where each key comes from, what it turns on, and what breaks without it.

---

## What it does

| Screen | What it is for |
|---|---|
| **Home** `/` | Today's ranked list, the day's periphery, and progress by life area. Changes shape by time of day. |
| **Goals** `/goals` | A seven-horizon tree with rolled-up progress, a twelve-month Gantt roadmap, and a drift view comparing stated priorities against actual effort. |
| **Work** `/work` | A six-column board, a sortable projects table, a five-section backlog, and a waiting-on list that ages. |
| **Brain** `/brain` | Journal, notes, thoughts, drafts, ideas, decisions, quotes and saves. A block editor with `@`-mentions that create real graph edges. |
| **People** `/people` | Learned contact cadence, reach-out priority, relationship memory. |
| **Library** `/library` | Books, media, articles, places and interests, each with its own status pipeline. |
| **Life** `/life` | One chronological timeline over every object type, with a year heat strip. |
| **Money** `/money` | Net worth, spending intelligence, financial goals with real projections, and natural-language what-if scenarios. |
| **Memory** `/memory` | Everything the system believes about you, with the evidence for each, and one click to correct it. |
| **Review** `/review` | Weekly review, a seven-step monthly reset, and a shareable annual page. |

### The ideas underneath

**One input.** `⌘K` captures, searches and navigates. A sentence captures; a
fragment searches; a verb surfaces commands. You never have to know which one
you wanted.

**Capture closes the loop, not just opens it.** "finished portfolio homepage"
ticks the task off, advances the milestone above it and moves the goal —
capture and debrief run the same matcher, so it does not matter which field you
typed it into. `@` opens a typeahead over the people, projects and goals you
already have.

**A hybrid graph.** Everything is an `object` with a type, and everything is
connected by a typed `edge`. Adding a new kind of thing is a row in
`object_type`, not a new component — `ObjectRow` and `ObjectDetail` render a
task, a goal, a person and a book from the same shape.

**Progress flows upward.** `task → milestone → project → goal → goal`. Complete
a task and the whole chain recalculates, snapshots to `metric`, and the
sparkline moves.

**Undo replaces confirm.** Every action applies immediately with a five-second
undo toast and `⌘Z`. The only confirmation in the product is for permanent
deletion.

**Suggestions arrive pre-applied.** AI-inferred fields render filled in with a
dashed underline. Change them or ignore them; ignoring means accepting.

**Nothing is required.** A task is a title. A goal is a sentence. A person is a
name.

---

## Architecture

```
Next.js 15 (App Router, React 19, TS strict)
  ├── UI      Tailwind 4 over a token layer · Radix · dnd-kit · Tiptap · cmdk
  ├── State   TanStack Query (server) · Zustand (shell)
  ├── API     Route Handlers, same repo, same deploy
  ├── Data    Postgres 16 + pgvector + pg_trgm, via Drizzle
  ├── Auth    Supabase Auth (or a documented local dev bypass)
  ├── AI      Claude for extraction, matching, breakdown, writing
  └── Jobs    Inngest, or the /api/cron/* routes behind Vercel Cron
```

```
src/
├── app/
│   ├── (app)/           the persistent three-pane shell and every route
│   ├── (auth)/          login, signup
│   └── api/             the whole API surface
├── components/
│   ├── ui/              Tier 1 — primitives, token-driven, no hardcoded values
│   ├── composite/       Tier 2 — ObjectRow, DataTable, Board, Gantt, Chart…
│   ├── shell/           Tier 3 — AppShell, Sidebar, ContextPane, BottomTabs
│   ├── capture/ debrief/ editor/ views/ charts/
├── hooks/               useBreakpoint, useContextPane, useKeyboardShortcuts…
├── lib/
│   ├── db/              Drizzle schema, graph traversal, rollup
│   ├── ai/              client, prompts, extraction, matching, ranking
│   ├── finance/         Plaid, projections, categorisation
│   ├── calendar/        Google sync, free-block computation
│   └── notify/          web push, email, SMS
├── jobs/                extraction, syncs, rollup, patterns, reviews
└── styles/
    ├── tokens.css       every value in the system, light and dark
    └── globals.css      Tailwind mapping — maps only, defines nothing
```

### The responsive system

One component tree, five breakpoints. Components never check the viewport —
they call `contextPane.open(id)` and the shell decides what that means.

| Width | Shell |
|---|---|
| ≥1440 **wide** | Sidebar 240 · main · context 360 |
| 1200 **standard** | Sidebar 240 · main · context 320 |
| 1024 **compact** | Rail 56 · main · context 320 |
| 768 **tablet** | Rail 56 · main · context as an overlay drawer |
| <768 **phone** | Single pane · bottom tabs · context as a real route |

The phone drops density and simultaneity, never features. Every route works at
every width, and Playwright asserts it at four viewports on every run.

### The design system

Monochrome. There is no accent colour anywhere in the interface — not on
buttons, links, focus rings, active states or badges. Hierarchy comes from a
four-step neutral surface ladder, 1px hairlines, type weight and whitespace.

The only chromatic pixels in the product are inside charts and progression
indicators, and colour is never the sole carrier of meaning: a trajectory pairs
its colour with a word, a chart series pairs its colour with a label.

Every value lives in `src/styles/tokens.css`. `npm run design:check` fails the
build on a hex literal, an arbitrary Tailwind value, a `dark:` variant, a radius
above 8px, or a gradient.

---

## Commands

```bash
npm run dev              # http://localhost:3000
npm run build            # production build
npm run typecheck        # tsc --noEmit, strict

npm run db:up            # local Postgres + pgvector in Docker
npm run db:down          # stop it
npm run db:migrate       # apply supabase/migrations in order (idempotent)
npm run db:seed          # realistic demo data
npm run db:reset         # down, up, migrate, seed

npm test                 # Vitest — rollup maths, matching, projections, components
                         # (needs a project path without a "*" — see SETUP.md)
npm run e2e              # Playwright at 1440 / 1200 / 834 / 375
npm run design:check     # the design system's hard rules
npm run inngest          # local Inngest dev server (optional)
```

## Keyboard

| Key | Action |
|---|---|
| `⌘K` | Command palette — capture, search and navigate |
| `C` | Capture |
| `D` | Debrief |
| `G` then `H G W B P L F M` | Home, Goals, Work, Brain, People, Library, Life, Money |
| `⌘\` | Toggle sidebar |
| `?` | Shortcut sheet |
| `J K` `↑↓` | Move selection |
| `E` `S` `T` `X` `1–4` | Complete · Snooze · Today · Select · Priority |
| `⌘Z` | Undo |
| `Esc` | Close pane, modal, or cancel an edit |

---

## Degrading gracefully

The app runs with only a database. Each key adds a capability and its absence is
visible in Settings rather than crashing a screen.

| Missing | What still works | What you lose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Capture, debrief matching, Today ranking, everything manual | Extraction into structured objects, project breakdown, rewriting, what-if |
| `OPENAI_API_KEY` | Keyword + verb matching, trigram duplicate detection | Semantic matching, semantic duplicates, voice capture |
| `PLAID_*` | Manual accounts and expenses from capture | Live balances and transaction sync |
| `GOOGLE_*` | Today ranking on deadlines and dependencies | Free-block scheduling, calendar write-back |
| `TWILIO_*` | Everything in the browser | Capture and complete by text message |
| `RESEND_API_KEY` | In-app notifications | Digest email, and the push fallback |
| VAPID keys | Email notifications | Browser push |
| `INNGEST_*` | Jobs run inline or on Vercel Cron | Durable retries and job observability |

---

## Security

- Row-level security on every user table, plus a `user_id` filter in application
  code on every query. The database refuses a query that loses its filter.
- Integration tokens are encrypted at rest (AES-256-GCM) with `ENCRYPTION_KEY`,
  which is separate from the database credentials.
- Plaid access tokens are exchanged and stored server-side and never reach the
  browser.
- CSP, `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`
  headers on every response.
- Per-user rate limits on capture and every AI route.
- Financial data is excluded from AI prompts unless the privacy setting permits
  it.

## Deployment

Vercel for the app, Supabase for Postgres and auth, Inngest or Vercel Cron for
jobs. `vercel.json` carries the cron schedule. See
[SETUP.md](./SETUP.md) § Deploying.

---

Built from `docs/lockin-build-direction.md`, `docs/lockin-ux-spec.md` and
`docs/DESIGN.md`, which remain the specification of record.
