# Life OS — Complete Build Direction

**Version:** 2.0
**Platform:** Responsive web application (desktop-first, collapses to tablet and phone)
**Status:** Ready for development
**Last updated:** September 3, 2026

---

## 0. Read this first

Life OS is a **web application**. It is not a mobile app and there is no React Native in this project. It is built for the desktop browser — a three-pane shell with a keyboard-driven command palette, drag-and-drop boards, and a twelve-month Gantt roadmap — and it responds down through tablet to phone widths using CSS breakpoints. On a phone it is the same app in a browser tab, optionally installed to the home screen as a PWA.

Three consequences that shape every decision below:

1. **No native app code.** No React Native, no Expo, no App Store or Play Store submission. One codebase, one deployment, works everywhere with a URL.
2. **Desktop layouts are the design target.** Multi-pane views, tables, hover states, right-click menus, and keyboard shortcuts are first-class, not afterthoughts. Phone layouts are derived by collapsing panes, not by starting from a phone and adding to it.
3. **Mobile capability parity, not layout parity.** Every route and every action works at 375px. The phone drops density and simultaneity, never features.

The product itself is described in `life-os-feature-overview.md`. The screens are specified in `life-os-ux-spec.md`. The database is in `life-os-schema.sql`. This document is the engineering plan.

---

## 1. Architecture

### 1.1 Stack

**Frontend**
- **Next.js 15** (App Router, React 19, TypeScript strict)
- **Tailwind CSS 4** with a custom design-token layer
- **Radix UI** primitives (dialog, popover, dropdown, context menu, tooltip, tabs)
- **dnd-kit** for all drag-and-drop — one library that handles pointer, touch, and keyboard sensors identically, which is why boards and roadmaps work on every device without branching code
- **TanStack Query** for server state, caching, and optimistic updates
- **Zustand** for local UI state (pane widths, sidebar collapsed, selection, modal stack)
- **cmdk** for the `⌘K` command palette
- **Tiptap** for the block editor (notes, journal, drafts)
- **visx** or lightweight custom SVG for charts, sparklines, and the roadmap Gantt
- **next-pwa** for the manifest and service worker (installability and offline shell only — not a native wrapper)

**Backend**
- **Next.js Route Handlers** for the API (same repo, same deployment)
- **Postgres 16** via **Supabase** — pgvector for embeddings, pg_trgm for fuzzy text, RLS for isolation
- **Supabase Auth** (email + OAuth)
- **Drizzle ORM** for typed queries, with raw SQL for the graph traversal and rollup functions
- **Anthropic Claude API** for extraction, matching, recommendations, and writing
- **Inngest** or **Trigger.dev** for background jobs (extraction, sync, rollup, reviews, notifications) — durable, retryable, observable

**Integrations**
- **Plaid** — bank, brokerage, and loan connections
- **Google Calendar / Microsoft Graph / CalDAV** — calendar sync
- **Gmail API / Microsoft Graph** — optional email scanning
- **Twilio** — SMS interface
- **OpenAI Whisper** or Deepgram — voice transcription
- **Resend** — transactional and digest email
- **Web Push (VAPID)** — browser notifications on desktop and Android

### 1.2 Why this stack

Next.js App Router keeps the API and the UI in one repo and one deploy, which matters for a solo or small team. Server Components render the initial shell fast; client components handle the interactive panes. TanStack Query gives optimistic updates so completing a task feels instantaneous even before the server confirms.

dnd-kit is the single most important library choice. Boards, the goal tree, the backlog, and the roadmap all depend on drag. dnd-kit's sensor abstraction means the same component works with a mouse on desktop, a finger on tablet, and arrow keys for accessibility — no separate mobile implementation.

Supabase gives Postgres with pgvector, auth, storage, and RLS without operating infrastructure. The hybrid-graph schema is plain Postgres, so there is no lock-in beyond convenience.

### 1.3 Repository structure

```
life-os/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (app)/                        ← the persistent shell
│   │   │   ├── layout.tsx                ← Sidebar + main + context pane
│   │   │   ├── page.tsx                  ← Home
│   │   │   ├── goals/
│   │   │   │   ├── tree/page.tsx
│   │   │   │   ├── roadmap/page.tsx
│   │   │   │   ├── drift/page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── work/
│   │   │   │   ├── board/page.tsx
│   │   │   │   ├── projects/page.tsx
│   │   │   │   ├── projects/[id]/page.tsx
│   │   │   │   ├── backlog/page.tsx
│   │   │   │   └── waiting/page.tsx
│   │   │   ├── brain/[[...slug]]/page.tsx
│   │   │   ├── people/[[...id]]/page.tsx
│   │   │   ├── library/[[...tab]]/page.tsx
│   │   │   ├── life/page.tsx
│   │   │   ├── money/[[...tab]]/page.tsx
│   │   │   ├── memory/page.tsx
│   │   │   ├── review/[period]/page.tsx
│   │   │   └── settings/[[...section]]/page.tsx
│   │   └── api/
│   │       ├── capture/route.ts
│   │       ├── capture/[id]/route.ts
│   │       ├── objects/route.ts
│   │       ├── objects/[id]/route.ts
│   │       ├── objects/bulk/route.ts
│   │       ├── edges/route.ts
│   │       ├── debrief/route.ts
│   │       ├── debrief/confirm/route.ts
│   │       ├── today/route.ts
│   │       ├── goals/tree/route.ts
│   │       ├── goals/drift/route.ts
│   │       ├── roadmap/route.ts
│   │       ├── search/route.ts
│   │       ├── ai/recommend/route.ts
│   │       ├── ai/breakdown/route.ts
│   │       ├── ai/rewrite/route.ts
│   │       ├── ai/should-i/route.ts
│   │       ├── money/dashboard/route.ts
│   │       ├── money/what-if/route.ts
│   │       ├── memory/route.ts
│   │       ├── review/[period]/route.ts
│   │       └── webhooks/
│   │           ├── plaid/route.ts
│   │           ├── twilio/route.ts
│   │           └── calendar/route.ts
│   │
│   ├── components/
│   │   ├── shell/
│   │   │   ├── AppShell.tsx              ← three-pane grid, breakpoint logic
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   ├── ContextPane.tsx           ← docked / drawer / route by width
│   │   │   ├── BottomTabs.tsx            ← phone only
│   │   │   └── CommandPalette.tsx        ← ⌘K
│   │   ├── capture/
│   │   │   ├── CaptureModal.tsx
│   │   │   ├── ExtractionReview.tsx
│   │   │   └── VoiceRecorder.tsx
│   │   ├── debrief/
│   │   │   ├── DebriefModal.tsx          ← 2-col wide, stacked narrow
│   │   │   ├── MatchList.tsx
│   │   │   └── ManualChecklist.tsx
│   │   ├── objects/
│   │   │   ├── TaskRow.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   ├── TaskDetail.tsx
│   │   │   ├── GoalRow.tsx
│   │   │   ├── GoalDetail.tsx
│   │   │   ├── PersonRow.tsx
│   │   │   ├── ObjectContextMenu.tsx
│   │   │   └── InlineField.tsx           ← click-to-edit, dashed-underline AI state
│   │   ├── views/
│   │   │   ├── GoalTree.tsx
│   │   │   ├── Roadmap.tsx               ← Gantt, zoom, load shading
│   │   │   ├── Board.tsx                 ← dnd-kit columns
│   │   │   ├── DataTable.tsx             ← sortable, selectable, responsive
│   │   │   ├── Timeline.tsx
│   │   │   └── MetricGrid.tsx
│   │   ├── editor/
│   │   │   ├── BlockEditor.tsx           ← Tiptap
│   │   │   ├── MentionMenu.tsx           ← @person, @project, @goal
│   │   │   └── WritingAssistant.tsx
│   │   ├── charts/
│   │   │   ├── Sparkline.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── DriftChart.tsx
│   │   │   └── TrajectoryChart.tsx
│   │   └── ui/                           ← Radix wrappers, buttons, toasts
│   │
│   ├── hooks/
│   │   ├── useBreakpoint.ts              ← wide | standard | compact | tablet | phone
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useContextPane.ts             ← open/close/route-vs-drawer
│   │   ├── useCapture.ts
│   │   ├── useObjects.ts
│   │   ├── useOptimisticComplete.ts
│   │   ├── useSelection.ts               ← shift/⌘ multi-select
│   │   └── useUndo.ts
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   ├── client.ts
│   │   │   ├── schema.ts                 ← Drizzle definitions
│   │   │   ├── graph.ts                  ← edge traversal
│   │   │   └── rollup.ts                 ← progress calculation
│   │   ├── ai/
│   │   │   ├── client.ts
│   │   │   ├── extract.ts                ← capture → objects
│   │   │   ├── match.ts                  ← debrief matching
│   │   │   ├── recommend.ts              ← Today ranking, what-should-I-do
│   │   │   ├── prompts/
│   │   │   └── embeddings.ts
│   │   ├── finance/
│   │   │   ├── plaid.ts
│   │   │   ├── projections.ts
│   │   │   └── categorize.ts
│   │   ├── calendar/
│   │   └── format.ts
│   │
│   ├── jobs/
│   │   ├── extract-capture.ts
│   │   ├── sync-calendar.ts
│   │   ├── sync-plaid.ts
│   │   ├── rollup-progress.ts
│   │   ├── detect-patterns.ts
│   │   ├── generate-review.ts
│   │   └── send-notifications.ts
│   │
│   └── styles/
│       ├── globals.css
│       └── tokens.css                    ← spacing, color, type scale
│
├── drizzle/                              ← migrations
├── schema.sql                            ← canonical schema
├── public/
│   ├── manifest.json                     ← PWA
│   └── icons/
├── e2e/                                  ← Playwright, multi-viewport
├── .env.example
└── package.json
```

---

## 2. The responsive system

This is the part that changes most from a mobile-first plan, so it is specified concretely before any feature work begins.

### 2.1 Breakpoint tokens

```ts
// src/lib/breakpoints.ts
export const BREAKPOINTS = {
  phone:    0,     // < 768   single pane, bottom tabs
  tablet:   768,   // 768+    icon rail, context pane as drawer
  compact:  1024,  // 1024+   icon rail, context pane docked 320
  standard: 1200,  // 1200+   sidebar expanded, context docked 320
  wide:     1440,  // 1440+   sidebar expanded, context docked 360
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;
```

```ts
// src/hooks/useBreakpoint.ts
// Returns the current breakpoint name. Uses matchMedia, not resize listeners.
// SSR-safe: renders `standard` on the server, corrects on hydration.
export function useBreakpoint(): Breakpoint;
export function useIsAtLeast(bp: Breakpoint): boolean;
```

Tailwind config mirrors these exactly so class-based and JS-based decisions never disagree:

```js
screens: {
  tablet:   '768px',
  compact:  '1024px',
  standard: '1200px',
  wide:     '1440px',
}
```

### 2.2 The shell

`AppShell.tsx` owns the grid and is the only component that knows about panes:

```
< tablet   : [ main ]                          bottom tabs, context = route
tablet     : [ rail | main ]                   context = overlay drawer
compact    : [ rail | main | context 320 ]
standard   : [ sidebar 240 | main | context 320 ]
wide       : [ sidebar 240 | main | context 360 ]
```

The context pane has three presentation modes and the shell picks one:

| Mode | When | Behavior |
|---|---|---|
| `docked` | ≥1024px | CSS grid column, resizable by dragging the divider, persists width |
| `drawer` | 768–1023px | Fixed overlay from the right with a scrim, `Esc` or scrim click closes |
| `route` | <768px | Pushes a real route (`/work/board` → `/work/tasks/:id`), browser back returns |

Components never check the width themselves. They call `useContextPane().open(objectId)` and the shell decides what that means. This is what keeps the phone version from becoming a separate codebase.

### 2.3 Responsive component contracts

Each complex view declares how it degrades, and this is enforced by Playwright tests at every viewport.

| Component | ≥1440 | 1024–1439 | 768–1023 | <768 |
|---|---|---|---|---|
| `Board` | 6 columns | 5 cols, h-scroll | 3 cols, h-scroll, sticky headers | segmented control, 1 column as list |
| `Roadmap` | 12 months | 6 months | 6 months, sticky label column | vertical list grouped by month |
| `GoalTree` | tree + docked detail | tree + docked detail | tree + drawer | depth-2 collapsed, detail as route |
| `DataTable` | all columns | drop `Load`, `Cadence` | drop to 3 columns | stacked cards |
| `DebriefModal` | 2-column, 900px | 2-column, 900px | stacked, 640px | full-screen route |
| `Home` | 3 panes | 3 panes | signals inline as cards | single column |
| `BlockEditor` | side-by-side with stream | side-by-side | editor as drawer | separate route |

### 2.4 Input parity

Every interaction has at least two paths, one of which is always available on every device:

| Action | Mouse | Keyboard | Touch |
|---|---|---|---|
| Complete | hover ✓ button | `E` | swipe right |
| Snooze | hover ⏰ button | `S` | swipe left |
| Open detail | click row | `Enter` | tap row |
| Reorder | drag | context menu → Move | long-press drag |
| Multi-select | shift/⌘-click | `X` | long-press then tap |
| Change status | drag between columns | `1`–`4`, context menu | tap card → detail → status |
| Capture | Capture button | `⌘K` or `C` | FAB |

dnd-kit is configured with `PointerSensor`, `TouchSensor` (250ms delay, 5px tolerance to avoid conflicting with scroll), and `KeyboardSensor` (space to lift, arrows to move, space to drop). This single configuration covers all three columns above.

### 2.5 PWA, not native

`manifest.json` gives standalone display, icons, theme color, and a `share_target` so Android's share sheet can send text and URLs straight into Capture. The service worker caches the app shell and static assets for fast loads and a usable offline shell; data is network-first with a stale-while-revalidate fallback so yesterday's Today list renders on a bad connection. There is no offline write queue in v1 — writes require connectivity and show a clear retry state.

---

## 3. Build phases

Eight phases. Each ends with something usable.

---

### Phase 1 — Shell, capture, Today, debrief (weeks 1–3)

The daily loop, end to end. When this ships you can use the product every day.

**Infrastructure**
- [ ] Next.js 15 project, TypeScript strict, Tailwind 4, path aliases
- [ ] Supabase project; run `schema.sql`; seed the 45 rows of `object_type`
- [ ] Drizzle schema generated from the database; typed client
- [ ] RLS policies on every table (`user_id = auth.uid()`)
- [ ] Supabase Auth: signup, login, session; create `app_user` + `user_settings` on first login
- [ ] Inngest (or Trigger.dev) wired with one test job
- [ ] Anthropic client with retry, timeout, and structured-output parsing

**The shell**
- [ ] `AppShell` with the five-breakpoint grid from §2.2
- [ ] `Sidebar` (240px) with collapse to rail, active-route highlight, persisted state
- [ ] `TopBar` with `⌘K` trigger, date, sync indicator, settings
- [ ] `ContextPane` with docked / drawer / route modes and a resizable divider
- [ ] `BottomTabs` for phone
- [ ] `useBreakpoint`, `useContextPane`, `useKeyboardShortcuts`
- [ ] Global shortcuts: `⌘K`, `C`, `D`, `/`, `G`+letter, `⌘\`, `Esc`, `?`
- [ ] Toast system with 5-second undo and `⌘Z`
- [ ] Design tokens: type scale, spacing, color, dark mode, `prefers-reduced-motion`

**Capture**
- [ ] `POST /api/capture` — store raw immediately, enqueue extraction, return `capture_id` in <100ms
- [ ] `GET /api/capture/:id` — poll for `processed_at` and the extraction payload
- [ ] Extraction job: Claude call with the contract prompt (§4), validate, persist proposal
- [ ] `CommandPalette` (cmdk): sentence → capture, fragment → search, verb → command
- [ ] `CaptureModal` 640px, autofocus, voice button, file drop
- [ ] `ExtractionReview`: checkboxes, inline type/title/date editing, Add all default, auto-apply on dismiss
- [ ] `POST /api/capture/:id/resolve` — create objects and edges from accepted rows
- [ ] Paste-URL and drag-file handlers at the shell level

**Objects**
- [ ] `POST /api/objects` — title + type is the only requirement
- [ ] `GET /api/objects` — filter by type, status, area, due, completed, project, goal
- [ ] `GET /api/objects/:id` — object with one hop of edges
- [ ] `PATCH /api/objects/:id` — partial update, writes `activity`
- [ ] `DELETE /api/objects/:id` — soft delete with undo window
- [ ] `POST /api/objects/bulk` — multi-select actions
- [ ] `POST /api/edges` / `DELETE /api/edges/:id`
- [ ] Database triggers for `activity` logging (already in `schema.sql`)

**Home**
- [ ] `GET /api/today` — ranked list (Phase 1: due date, priority, status; AI ranking lands in Phase 3)
- [ ] Home three-pane layout with morning / afternoon / evening states by local time
- [ ] `TaskRow` with hover actions, keyboard focus, optimistic complete
- [ ] Progress strip reading latest `metric` rows per area
- [ ] Milestone-reached inline banner on completion
- [ ] Responsive collapse per §2.3

**Debrief**
- [ ] `POST /api/debrief` — capture text, run matching, return matches + new objects
- [ ] `POST /api/debrief/confirm` — complete, snooze, create, log, rollup, return summary
- [ ] `DebriefModal`: two-column at ≥768px, stacked below, full-screen route on phone
- [ ] Live matching as you type (600ms debounce)
- [ ] Confidence tiers: ≥0.85 checked, 0.50–0.84 unchecked, <0.50 new
- [ ] `ManualChecklist` synced bidirectionally with the match list
- [ ] Summary card on confirm

**Board**
- [ ] `Board` with dnd-kit, six columns, pointer + touch + keyboard sensors
- [ ] Drag between columns updates status optimistically
- [ ] Lens filter (area / goal / project) over one dataset
- [ ] Multi-select with floating bulk bar
- [ ] `ObjectContextMenu` on right-click
- [ ] Responsive: 6 → 5 → 3 columns → segmented control

**Testing**
- [ ] Vitest: rollup math, match scoring, extraction parsing (mocked Claude)
- [ ] Testing Library: TaskRow, ExtractionReview, DebriefModal
- [ ] Playwright at 1440 / 1200 / 900 / 375: signup → capture → complete → debrief → progress moved

**Done when:** you type "email Sarah tomorrow" into `⌘K`, see it on Home the next morning, type "emailed Sarah" into Debrief at night, and watch it check itself off — on a laptop and on a phone browser.

---

### Phase 2 — Goals, hierarchy, roadmap (weeks 4–6)

Progression becomes visible. This is the phase that delivers what you asked for.

- [ ] Goal CRUD with seven horizons and life areas
- [ ] `GET /api/goals/tree` — recursive CTE returning the hierarchy with rolled-up progress
- [ ] `GoalTree`: expand/collapse with persisted state, keyboard navigation, drag to reparent, inline child creation
- [ ] Goal detail in the context pane: metric, trajectory, sparkline, why-chain breadcrumb, linked projects, this week's tasks, reflections
- [ ] Inline goal creation: type a sentence, AI fills horizon / area / parent / metric / target / deadline as dashed suggestions
- [ ] Project and milestone CRUD; project detail route with nested milestone/task lists
- [ ] `POST /api/ai/breakdown` — project description to milestones and tasks; preserves completed items on regeneration
- [ ] `GET /api/roadmap` — bars, milestones, and per-period load
- [ ] `Roadmap` Gantt: five zoom levels, drag to reschedule with proportional shift, edge-drag to resize, load shading from calendar capacity, sticky label column
- [ ] `rollup_progress()` triggered on completion and nightly; snapshots to `metric`
- [ ] Trajectory: `ahead` / `on_track` / `behind` from progress vs. elapsed time
- [ ] Automatic task→goal alignment; "why this matters" line generated from the chain
- [ ] `GET /api/goals/drift` and the Drift view; every bar drills into its completions
- [ ] Responsive: roadmap to vertical month list on phone; tree to depth 2

**Done when:** you create "Build a business," accept an AI breakdown, drag November's project into December because the load strip shows November is overloaded, complete a task, and watch Career move 68% → 72% with the sparkline updating.

---

### Phase 3 — Brain, journal, personal model, AI intelligence (weeks 7–9)

- [ ] Journal, thought, note, draft, idea, decision, quote, save object types
- [ ] `Brain` two-pane: filterable stream left, editor right; separate routes on phone
- [ ] Tiptap block editor: headings, lists, checklists, tables, images, files, code, quotes
- [ ] `@` mention menu creating real edges to people, projects, goals, books, places
- [ ] Journal editor: serif, wide measure, autosave, verbatim storage
- [ ] Collapsed reflection panel: patterns, connections, "turn into" chips
- [ ] Pattern detection job: theme extraction, recurrence counting, surfaced at 3+ occurrences in 30 days
- [ ] Drafts with recipient link and the writing assistant toolbar
- [ ] `POST /api/ai/rewrite` — improve / shorter / warmer / professional / casual / clearer / sound-like-me
- [ ] Voice sample collection in settings feeding "sound like me"
- [ ] Idea pipeline board; promote-to-project
- [ ] Structured decisions with reasoning, alternatives, revisit date
- [ ] Saves grid with AI cluster chips
- [ ] `model_fact` extraction from journal, completions, and decisions
- [ ] `/memory` screen: facts by category with statement, confidence, evidence links, and Right / Wrong / Changed / Private / Forget actions
- [ ] Conversational "what do you know about me?" with plain-language correction
- [ ] `POST /api/ai/recommend` — replaces Phase 1's naive Today ranking with the full weighting (§4.4)
- [ ] `POST /api/ai/should-i` — decision analysis; saveable as a Decision

**Done when:** you journal about feeling stretched for the fourth time and the app connects it to your eight active projects and offers a focus recommendation.

---

### Phase 4 — People, library, experiences, timeline (weeks 10–12)

- [ ] Person object with full field set; automatic creation from capture with duplicate detection
- [ ] `/people` table + context pane detail; reach-out priority sort
- [ ] Interaction logging from capture and inline
- [ ] Cadence learning: rolling median of interaction gaps per person; overdue detection with context suggestion
- [ ] Birthday and follow-up reminders; draft-message action
- [ ] Library types with per-type status pipelines, ratings, notes, quotes, key ideas, recommender links
- [ ] `/library` grid and list views by tab
- [ ] Interests with attached items, sparkline, promote-to-goal
- [ ] Emerging-interest detection from save clustering
- [ ] Experience objects with date, location, people, photos
- [ ] `/life` timeline: day / month / year zoom, type and person filters, year heat strip
- [ ] Document upload to Supabase Storage with text extraction and search indexing

**Done when:** "Coffee with Sarah, she recommended The Mom Test" creates the interaction, updates her cadence, adds the book, and links the recommendation — from one sentence.

---

### Phase 5 — Money (weeks 13–15)

- [ ] Plaid Link flow; item and account storage; token encryption
- [ ] Transaction sync job three times daily with cursor pagination
- [ ] AI categorization with user override and learning from corrections
- [ ] Manual accounts and manual expenses from capture
- [ ] `GET /api/money/dashboard`: net worth, cash, investments, debt, income, spending, savings rate, each with deltas and sparklines
- [ ] Financial goal objects with target, date, assumed return, required vs. actual monthly, projection
- [ ] Trajectory computation and on-track / behind badges
- [ ] Reality-check mode: direct language plus the lever list
- [ ] Spending intelligence: category trends vs. three-month average, anomalies, lifestyle inflation
- [ ] Recurring-charge detection with "last mentioned" cross-referenced against captures
- [ ] Debt payoff ordering and timelines
- [ ] `POST /api/money/what-if` — natural-language scenarios with full downstream cascade; saveable and comparable
- [ ] Finance → tasks: generate closing actions when a goal is behind, linked back to the goal
- [ ] Responsive metric grid: 4-up → 2-up → stacked

**Done when:** you connect a bank, create "$1M by 35," see you're $900/month short, accept three generated actions, and watch the projected date move.

---

### Phase 6 — Reviews and reflection (weeks 16–18)

- [ ] Weekly review generation (Sundays): counts, goal deltas, people, learning, money, journal themes, postponed items
- [ ] Weekly observations from the activity log and journal patterns
- [ ] `/review/weekly` page with Do / Park / Drop chips and one question
- [ ] Monthly reset wizard: seven steps, progress rail, every step skippable
- [ ] Horizon-by-horizon goal review with Keep / Edit / Done / Drop
- [ ] Project and backlog rebalancing suggestions with an active-project ceiling
- [ ] Life Balance view: qualitative area read over 30/90 days
- [ ] Annual review generation: stats, charts, themes, decisions, "wanted but haven't done," how-you-changed narrative
- [ ] Shareable annual page with a public link toggle
- [ ] Personal analytics: time allocation, goal movement, habit adherence, spending by category

**Done when:** end of September, the reset walks you from "here's what happened" to a realistic October in ten minutes.

---

### Phase 7 — Integrations (weeks 19–22)

- [ ] Google Calendar OAuth + incremental sync; Microsoft Graph; CalDAV for Apple
- [ ] Free-block computation feeding Today scheduling and the roadmap load strip
- [ ] Write-back: scheduling a task creates a calendar event
- [ ] Twilio inbound webhook → capture pipeline → SMS reply with the summary
- [ ] SMS conversation context for follow-ups
- [ ] Gmail / Graph optional scanning: commitments, invitations, new people, receipts — all suggestions, never actions
- [ ] Voice capture via MediaRecorder → Whisper → capture field
- [ ] Web Push (VAPID) for desktop and Android; email digests via Resend as the fallback for iOS Safari
- [ ] Notification scheduler: morning, afternoon, evening, weekly, monthly, urgent — with a one-proactive-per-day attention budget
- [ ] PWA manifest, service worker, `share_target`, install prompt
- [ ] Browser extension (Chrome/Firefox): right-click "Save to Life OS"

**Done when:** you text "finished the homepage" from a grocery store and the milestone advances.

---

### Phase 8 — Refinement (weeks 23–26)

- [ ] Duplicate resolution across all types with confidence-gated confirmation
- [ ] Recurrence: rrule support, instance generation, habit cadence
- [ ] Proactive observation engine with the attention budget
- [ ] Constructive challenge prompts (stated priority vs. actual effort, project overload)
- [ ] Permission levels: observe / suggest / draft / execute with per-capability toggles
- [ ] Full-text + vector hybrid search with conversational answers
- [ ] Rate limiting, graceful AI degradation (store raw, retry later), Plaid failure handling
- [ ] Performance pass against §6 budgets
- [ ] Accessibility audit: WCAG AA, keyboard coverage, screen reader, focus management
- [ ] Onboarding: identity statement, first three goals, first capture, connect one integration
- [ ] Full data export (JSON + Markdown)

---

## 4. AI specification

### 4.1 Extraction contract

Every capture goes to Claude with a system prompt that returns strict JSON:

```json
{
  "objects": [
    {
      "tmp": "o1",
      "type": "person",
      "title": "Alex",
      "props": { "company": "OpenAI", "interests": ["robotics"] },
      "area": "career",
      "confidence": 0.94,
      "match": { "object_id": null, "candidates": [{ "id": "uuid", "score": 0.31 }] }
    }
  ],
  "edges": [{ "from": "o1", "to": "o2", "rel": "with", "confidence": 0.90 }],
  "updates": [{ "object_id": "uuid", "set": { "props.company": "Anthropic" }, "confidence": 0.88 }],
  "completions": [{ "object_id": "uuid", "confidence": 0.98, "evidence": "finished the homepage" }],
  "not_done": [{ "object_id": "uuid", "snooze_to": "tomorrow" }],
  "expenses": [{ "amount": 60, "merchant": "dinner", "category": "restaurants" }],
  "journal": { "body": "…", "mood": "good", "themes": ["startup", "job search"] },
  "questions": []
}
```

Rules given to the model: never invent facts not present in the text; confidence below 0.5 means omit or ask; one capture routinely yields several objects; always propose edges, because an unconnected object is nearly worthless; use only the type and relation vocabularies from `object_type` and the edge conventions.

Types, relations, and life areas are injected into the prompt from the database so the vocabulary can grow without a code change.

### 4.2 Duplicate detection

Before creating any object, compute candidates: trigram similarity on title, plus embedding cosine similarity, plus type match, plus contextual agreement (same company, recent interaction, same project). Above 0.85 → merge silently and record an update. Between 0.6 and 0.85 → ask inline in the review card ("Same Sarah Chen?"). Below 0.6 → create new.

### 4.3 Debrief matching

Candidate set: open objects of type task, habit, milestone, or waiting_on, with status in (today, doing, next), or due within one day, or any active habit.

Score = 0.55 × embedding similarity + 0.25 × keyword overlap + 0.10 × recency + 0.10 × completion-verb proximity.

Habits additionally extract a numeric value and unit ("ran 4 miles" → 4, mi). Expenses extract amount, merchant, and category. Anything unmatched above 0.5 becomes a new object proposal.

### 4.4 Today ranking

Weighted composite, recomputed each morning and after any change:

- Deadline pressure (overdue and due-today dominate)
- Unblock value (count of tasks this one unblocks, from the `blocks` edges)
- Goal priority (horizon proximity × stated area priority)
- Calendar fit (does the estimate fit an actual free block)
- Energy match (focus work into your historically best window from `model_fact`)
- Avoidance (postponed twice or more gets a boost, not a penalty)
- Relationship debt (overdue cadence)
- Financial urgency (a goal behind trajectory promotes its generated actions)
- Diversity penalty (avoid three items from one project)

Every returned item carries a one-sentence `why` string generated from the top-weighted factor.

---

## 5. API reference

All routes are Next.js Route Handlers under `/api`, authenticated by Supabase session cookie, scoped by RLS.

```
POST   /api/capture                 { channel, raw_text?, media_url?, transcript? } → { capture_id }
GET    /api/capture/:id             → { raw_text, processed_at, extraction }
POST   /api/capture/:id/resolve     { accept: [...], reject: [...], edits: {...} } → { created: [...] }

GET    /api/objects                 ?type&status&area&goal&project&due_before&completed
POST   /api/objects                 { type, title, ...optional } → object
GET    /api/objects/:id             → object + one hop of edges
PATCH  /api/objects/:id             partial → object
DELETE /api/objects/:id             soft delete → { undo_token }
POST   /api/objects/bulk            { ids, action, payload }

POST   /api/edges                   { from_id, to_id, rel }
DELETE /api/edges/:id

GET    /api/today                   → [{ object, why, suggested_slot }]
POST   /api/debrief                 { text } → { matches, new_objects, expenses, journal }
POST   /api/debrief/confirm         { completed, not_done, new } → { summary, deltas }

GET    /api/goals/tree              → nested with progress + trajectory
GET    /api/goals/drift             ?period → { stated, actual, observations }
GET    /api/roadmap                 ?from&to&zoom → { bars, milestones, load }

POST   /api/ai/breakdown            { object_id } → { milestones, tasks }
POST   /api/ai/recommend            { available_minutes? } → [{ object, why }]
POST   /api/ai/rewrite              { text, action, person_id? } → { text }
POST   /api/ai/should-i             { question } → { improves, costs, conflicts, net }

GET    /api/money/dashboard         → metrics + goals
POST   /api/money/what-if           { question } → { scenario, goal_impacts }

POST   /api/search                  { query } → { results, answer? }
GET    /api/memory                  → facts by category
PATCH  /api/memory/:id              { status } → fact
GET    /api/review/:period          ?start → review
POST   /api/review/:period/confirm  { answers, changes }
```

---

## 6. Performance budgets

Measured on a mid-range laptop, throttled to Fast 3G for network figures.

| Metric | Target |
|---|---|
| First contentful paint | < 1.2s |
| Time to interactive (Home) | < 2.0s |
| Capture save acknowledged | < 100ms (raw write precedes extraction) |
| Extraction round trip | < 3s p50, < 6s p95 |
| Task completion feedback | < 16ms (optimistic, no network wait) |
| Goal tree render, 500 nodes | < 300ms |
| Roadmap render, 40 projects × 12 months | < 400ms |
| Board drag frame rate | 60fps |
| Search results | < 500ms |
| Route transition within shell | < 150ms, no shell remount |

Techniques: Server Components for static shell, streaming for slow panes, virtualized lists above 100 rows, `content-visibility` on off-screen board columns, optimistic mutations everywhere, prefetch on hover for sidebar routes.

---

## 7. Testing

**Unit (Vitest).** Rollup math against fixtures, trajectory computation, match scoring, extraction parsing with mocked Claude, financial projections, cadence calculation, breakpoint resolution.

**Component (Testing Library).** Each interactive component at three viewports. Keyboard paths tested explicitly: `E` completes, `S` snoozes, `Esc` closes, arrow keys drag.

**E2E (Playwright).** Every flow runs at four viewports — 1440×900, 1200×800, 834×1112, 375×812 — and each has a viewport-specific assertion:

- 1440: three panes visible simultaneously, six board columns, twelve roadmap months
- 1200: context pane docked at 320
- 834: sidebar is a rail, context opens as a drawer with a scrim
- 375: bottom tabs present, context opens as a route, board is segmented

Core flows: signup → onboarding → first capture → Today → complete → debrief → progress moved. Goal creation → AI breakdown → roadmap drag → milestone completion → goal delta. Bank connect (Plaid sandbox) → financial goal → behind detection → generated tasks.

**Accessibility.** axe-core in CI on every route. Manual screen-reader pass on Home, Board, and Debrief per phase.

---

## 8. Deployment

**Hosting.** Vercel for the Next.js app. Supabase for Postgres, auth, and storage. Inngest for jobs. All three have generous free tiers and scale without operational work.

**Environments.** `production`, `preview` (per PR, with a seeded branch database), `local` (Supabase CLI + Docker).

**Migrations.** Drizzle Kit generates SQL; migrations run in CI before deploy; rollback plan documented per migration.

**Scheduled jobs.**

| Job | Schedule |
|---|---|
| Extract capture | on demand, queued |
| Sync calendar | every 30 min |
| Sync Plaid | 06:00, 14:00, 22:00 local |
| Rollup progress | 03:00 local + on completion |
| Detect patterns | nightly |
| Generate weekly review | Sundays 18:00 local |
| Generate monthly review | last day of month, 18:00 local |
| Send notifications | every 15 min, filtered by user schedule |

**Environment variables.**

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
ANTHROPIC_API_KEY
OPENAI_API_KEY                  # embeddings + Whisper
PLAID_CLIENT_ID
PLAID_SECRET
PLAID_ENV
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
RESEND_API_KEY
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY
ENCRYPTION_KEY                  # for integration tokens at rest
```

**Monitoring.** Sentry for errors with release tracking. Vercel Analytics for Core Web Vitals. Inngest dashboard for job health. Alerts on: Plaid sync failures, extraction error rate above 2%, p95 API latency above 2s, any job failing twice consecutively.

**Security.** RLS on every table. Integration tokens encrypted at rest with a separate key. Plaid access tokens never sent to the client. CSP headers. Rate limiting per user on capture and AI routes. Financial data excluded from AI prompts unless the relevant privacy tier permits it.

---

## 9. Definition of done, per phase

| Phase | Ship criterion |
|---|---|
| 1 | The full daily loop works at 1440 and 375. Capture, Today, complete, debrief, progress. |
| 2 | Goal tree, roadmap with drag-reschedule, and rolled-up progress that moves when you finish a task. |
| 3 | Journal patterns surface after three occurrences; the memory screen shows evidence for every fact. |
| 4 | One sentence creates a person, an interaction, a book, and the recommendation edge between them. |
| 5 | A connected account produces a live net worth and a financial goal that knows it's behind. |
| 6 | The monthly reset takes ten minutes and produces a realistic next month. |
| 7 | SMS completes a task; the calendar drives Today's scheduling. |
| 8 | Performance budgets met; axe clean; export works. |

---

## 10. Kickoff checklist

- [ ] Repo created, Next.js 15 + TypeScript strict + Tailwind 4
- [ ] Supabase project provisioned; `schema.sql` applied; `object_type` seeded
- [ ] RLS policies verified with a two-user test
- [ ] Auth flow working end to end
- [ ] `AppShell` renders correctly at all five breakpoints
- [ ] `⌘K` opens; `Esc` closes; `G H` navigates
- [ ] `POST /api/capture` returns in under 100ms with the raw row written
- [ ] Claude extraction returns valid JSON against ten fixture inputs
- [ ] One task can be created, completed, and undone
- [ ] Playwright runs green at four viewports in CI
- [ ] Sentry and Inngest receiving events
- [ ] Preview deploys on every PR

---

**The whole product in four lines.** Capture anything in one field. The AI turns it into structured, connected objects. The hierarchy shows whether your days are moving your years. Every evening you write a paragraph and it keeps the whole thing current.

Built for the browser, on a desk, where you can actually see it.
