# Life OS — Screen-by-Screen UX Specification

**Platform:** Responsive web application. Designed for the desktop browser first, collapsing gracefully to tablet and phone. Not a mobile app; a web app that works everywhere.

---

## 1. Platform and layout system

### 1.1 Why desktop-first

You use this at a desk in the morning and afternoon, and you want to *see progression*. Progression is spatial: a goal tree with a detail pane beside it, a roadmap spanning twelve months, a board with six columns visible at once. None of that fits on a phone. Designing for the phone first would force every one of those views into a single scrolling column, and the structure — the thing you actually want — would be the first casualty.

So the desktop canvas is the real design target. The phone gets a faithful, reduced version of the same app: same routes, same data, same actions, fewer panes.

### 1.2 The three-pane shell

The entire application lives in one persistent shell. Navigating never reloads the page or loses your place.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Life OS            [ ⌘K  Search or capture… ]        Thu 3 Sep   ⟳ synced ⚙ │ ← 56px
├───────────┬──────────────────────────────────────────┬───────────────────────┤
│           │                                          │                       │
│  HOME     │                                          │                       │
│  GOALS    │                                          │                       │
│  WORK     │            MAIN PANE                     │    CONTEXT PANE       │
│  BRAIN    │            (flexible)                    │    (360px, optional)  │
│  PEOPLE   │                                          │                       │
│  LIBRARY  │                                          │    Whatever you last  │
│  LIFE     │                                          │    clicked: a task,   │
│  MONEY    │                                          │    a goal, a person   │
│  ───────  │                                          │                       │
│  MEMORY   │                                          │                       │
│  REVIEW   │                                          │                       │
│  ───────  │                                          │                       │
│  + Capture│                                          │                       │
└───────────┴──────────────────────────────────────────┴───────────────────────┘
   240px                                                        360px
```

**Sidebar (240px, fixed).** Primary navigation. Collapses to a 64px icon rail with `⌘\`. Items expand to show sub-views (Goals → Tree, Roadmap, Drift). Bottom of the sidebar holds the Capture button and a small "today's progress" strip.

**Main pane (flexible).** The current view. Minimum 640px before the context pane is forced to overlay.

**Context pane (360px, optional).** The biggest desktop advantage, and it changes how the app feels. Click a task on the board and its detail opens *beside* the board, not on top of it. Click a goal in the tree and its detail opens beside the tree, so you can walk the hierarchy and read details without ever losing the tree. Dismissible with `Esc`. Remembers its width (drag the divider, 320–520px).

### 1.3 Breakpoints

| Width | Name | Shell behavior |
|---|---|---|
| ≥1440px | **Wide** | Full three-pane. Sidebar expanded. Context pane docked. Roadmap shows 12 months. Board shows all 6 columns. |
| 1200–1439px | **Standard** | Three-pane. Context pane 320px. Roadmap 6 months. Board 5 columns with h-scroll. |
| 1024–1199px | **Compact** | Two-pane. Sidebar auto-collapses to icon rail. Context pane docked at 320px. |
| 768–1023px | **Tablet** | Single main pane. Sidebar is an icon rail. Context pane becomes a right-side **overlay drawer** with a scrim. Board h-scrolls, 3 columns visible. |
| <768px | **Phone** | Single pane, full width. Sidebar becomes a **bottom tab bar** (Home · Goals · Work · Brain · More). Context pane becomes a **full-screen route** with a back button. Roadmap becomes a vertical list by month. Goal tree collapses to depth 2. |

Every route works at every width. Nothing is desktop-only or phone-only. The phone version drops density, never capability.

### 1.4 Interaction model (desktop primary)

Keyboard-and-mouse native. Touch gestures are additive on tablet and phone, never required.

| Input | Behavior |
|---|---|
| **Hover** | Row actions appear inline (complete, snooze, open, more). No hidden menus. |
| **Click** | Opens in the context pane. Never a modal, unless the action is genuinely blocking (Capture, Debrief, Monthly Reset). |
| **Right-click** | Context menu on any object: Complete · Snooze · Change status · Move to project · Link to goal · Set priority · Copy link · Delete. |
| **Drag** | Reorder lists, move cards between columns, reparent goals, resize roadmap bars. dnd-kit, so mouse and touch behave identically. |
| **Shift-click** | Range select in any list. |
| **⌘-click** | Add to selection. Selection shows a floating bulk-action bar. |
| **Double-click text** | Inline edit. Blur or `Enter` saves, `Esc` cancels. |
| **Swipe** (touch only) | Right = complete, left = snooze. A tablet/phone shortcut mirroring hover actions. |

### 1.5 Keyboard shortcuts

Global:

| Key | Action |
|---|---|
| `⌘K` | Command palette — capture, search, and navigate in one field |
| `C` | Capture directly |
| `D` | Debrief (evening close) |
| `/` | Focus search |
| `G` then `H/G/W/B/P/L/F/M` | Go to Home, Goals, Work, Brain, People, Library, Life, Money |
| `⌘\` | Toggle sidebar |
| `Esc` | Close context pane, modal, or cancel edit |
| `?` | Shortcut cheat sheet |

In lists and boards:

| Key | Action |
|---|---|
| `J` / `K` or `↑` `↓` | Move selection |
| `Enter` | Open in context pane |
| `X` | Toggle select |
| `E` | Complete |
| `S` | Snooze menu |
| `T` | Move to Today |
| `1`–`4` | Set priority |
| `⌘Z` | Undo |

The keyboard path matters because the morning check-in should take sixty seconds: `G H` → read → `E E E` → done, without touching the mouse.

### 1.6 The six friction rules

These hold at every breakpoint.

1. **No required fields.** A task is a title. A goal is a sentence. A person is a name. Everything else is inferred or added later.
2. **Undo replaces confirm.** Actions apply immediately with a 5-second undo toast and `⌘Z`. No "are you sure?" except for permanent deletion.
3. **AI suggestions arrive pre-applied.** Inferred fields render filled in with a dashed underline. Change it or ignore it; ignoring means accepting.
4. **One input everywhere.** `⌘K` captures, searches, and navigates. You never have to know which one you wanted.
5. **Progressive disclosure.** Main pane shows the summary, context pane the detail, a dedicated route everything. Three levels, always in that order.
6. **Manual always works.** Every automatic action has a one-click manual equivalent: checkbox, drag, right-click, inline edit.

---

## 2. SCREEN — Home (`/`)

The screen you open three times a day. Adapts by time of day.

### 2.1 Wide layout (morning)

```
┌───────────┬────────────────────────────────────────────┬──────────────────────┐
│ HOME    ● │  Good morning, Sam.            Thu 3 Sep    │  UP NEXT             │
│ GOALS     │  Busy day. Here's what matters.             │                      │
│ WORK      │                                             │  9:00  Team sync     │
│ BRAIN     │  ┌─ TODAY ─────────────────────── 0 / 5 ─┐ │  10:30 1:1 w/ Dana   │
│ PEOPLE    │  │ ○ Finish portfolio homepage      1:30p│ │  ──────────────      │
│ LIBRARY   │  │   Career → Design role · unblocks 3   │ │  1:30–3:30  FREE     │
│ LIFE      │  │                          [✓] [⏰] [↗] │ │  ← homepage fits     │
│ MONEY     │  │ ○ Send proposal to Alex      due tmw  │ │                      │
│ ───────   │  │   Job search · 30 min                 │ │  ──────────────      │
│ MEMORY    │  │ ○ Call Sarah                          │ │  🎂 Sarah's birthday │
│ REVIEW    │  │   51 days · usual 30                  │ │     tomorrow         │
│           │  │ ○ Workout                     3 of 3  │ │     [Draft message]  │
│           │  │ ○ Update resume        3rd week ↻     │ │                      │
│ ───────   │  └───────────────────────────────────────┘ │  ──────────────      │
│ Today     │                                             │  💡 Last night's     │
│ ▓▓▓░░ 0/5 │  ┌─ PROGRESS ──────────────────────────┐  │     journal has a    │
│           │  │ Career        ████████░░  72%   ↑ 4  │  │     startup idea.    │
│ + Capture │  │ Finance       ██████░░░░  63%   ↑ 2  │  │     [Make project]   │
│      ⌘K   │  │ Health        █████░░░░░  48%   → 0  │  │                      │
│           │  │ Relationships █████░░░░░  55%   ↑ 1  │  │  ──────────────      │
│           │  │ Learning      ███████░░░  70%   ↑ 6  │  │  ⚠ Dining is 12%     │
│           │  └──────────────────────────────────────┘  │     over average.    │
│           │                                             │     Savings on track.│
│           │  If you only do one thing today:            │                      │
│           │  finish the portfolio homepage.             │                      │
│           │  It's blocking three tasks in Job search.   │                      │
└───────────┴────────────────────────────────────────────┴──────────────────────┘
```

The context pane on Home isn't a detail view — it's the day's periphery: calendar, one person signal, one brain signal, one money signal. Everything a phone layout would stack below the fold now sits *beside* the fold. You see your whole morning without scrolling.

### 2.2 Row interactions

Hovering a Today row reveals three inline buttons: **✓** complete, **⏰** snooze, **↗** open in context pane. Clicking the row body opens it in the context pane. Right-click gives the full menu. `E` completes the focused row.

Completing: the circle fills, the row strikes through and fades over 400ms, progress bars animate, an undo toast appears bottom-left for 5 seconds. If the completion reaches a milestone, a small banner slides in beneath the row: *"'Deployed' milestone reached. Career 68% → 72%."*

### 2.3 Time-of-day states

**Morning (until noon).** As above.

**Afternoon (noon–6pm).** Header becomes "Good afternoon. 2 left." Today collapses to remaining items. The context pane leads with your next free block and the single best-fitting task: *"45 minutes before your 3:30. Finish the homepage — it fits and unblocks three things."* Progress and signals collapse behind "Show more."

**Evening (after 6pm).** Header becomes "How did today go?" with a prominent **Debrief** button (or `D`). Today's remaining items render as a plain checklist so you can click through manually instead of typing. Progress shows the day's deltas.

### 2.4 Narrower widths

**Compact.** Context pane narrows to 320px; calendar shows only the next two events.
**Tablet.** Context content moves inline: calendar becomes a horizontal strip under the header; the three signals become a row of three cards below Progress.
**Phone.** Single column in order: greeting, Today, calendar strip, signal cards, progress, the "one thing" line. Bottom tab bar. Capture is a floating action button above the bar.

---

## 3. SCREEN — Capture (`⌘K` / `C`)

A centered modal, 640px wide, over a dimmed backdrop. The one moment a modal is correct, because capture should block everything else for the ten seconds it takes.

### 3.1 The command palette

`⌘K` opens a single field that does three jobs and decides which by what you type:

```
┌─────────────────────────────────────────────────────────────┐
│  ⌘  Met Alex at lunch, he's at OpenAI and interested in     │
│     robotics. Said he'd intro me to their design lead.       │
│     Follow up Tuesday.                                       │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│  ↵  Capture this                                             │
│  ⇥  Search instead                                           │
│                                                       🎤 📎  │
└─────────────────────────────────────────────────────────────┘
```

- A **sentence** (verbs, length, punctuation) → capture is the default action.
- A **short fragment** ("sarah", "portfolio") → live search results below, capture still on `↵`.
- A **command** ("go goals", "new project") → navigation and creation commands surface.

`Enter` captures. `Tab` switches to search. `Esc` closes and preserves the draft.

### 3.2 The review card

Save is instant — raw text hits the database immediately. Extraction returns in one to two seconds and replaces the modal contents in place:

```
┌─────────────────────────────────────────────────────────────┐
│  Found 5 things                              from your text │
│                                                              │
│  ☑ 👤 Person      Alex · OpenAI · robotics                   │
│  ☑ ⏳ Waiting     Intro to OpenAI design lead                │
│  ☑ ○  Task        Follow up with Alex        Tue 8 Sep  ⌄    │
│  ☑ 💬 Interaction Lunch — robotics, intro                    │
│  ☑ 📝 Note        Lunch conversation                         │
│                                                              │
│  Linked to:  Career goal · Job search project                │
│                                                              │
│  [ Add all ]   Review each   Keep as note only    ⌘↵ to add │
└─────────────────────────────────────────────────────────────┘
```

**Add all** is the default and fires automatically if you dismiss the card or press `Esc` — dismissing means accepting, because the alternative is losing what you typed. **Review each** expands rows into inline editors. **Keep as note only** stores the raw text with no extraction.

Every row is individually uncheckable. Unchecking is the only friction the flow ever asks for, and only when the AI got something wrong.

### 3.3 Other capture routes

- **Paste a URL** anywhere → capture opens pre-filled, title and summary fetched.
- **Drag a file** onto any window → capture opens with the file attached, text extracted.
- **Voice** → mic records via MediaRecorder, transcribes, drops text into the field to read before saving.
- **Browser extension** → right-click any page, "Save to Life OS."
- **PWA share target** on Android → the app appears in the system share sheet.
- **SMS** → texting your Life OS number runs the same pipeline and replies with a summary.

### 3.4 Phone

Modal becomes a full-screen sheet rising from the bottom, input focused, keyboard up. The review card is the same list, full width, with a sticky "Add all" bar at the bottom.

---

## 4. SCREEN — Debrief (`D`)

The most important screen for daily use. You describe your day; it checks things off.

### 4.1 Wide layout — a two-column modal (900px)

```
┌────────────────────────────────────────────────────────────────────────┐
│  How did today go?                                    Thu 3 Sep    ✕   │
├──────────────────────────────────┬─────────────────────────────────────┤
│                                  │  WHAT I MATCHED                     │
│  Finished the homepage and       │                                     │
│  pushed it live. Ran 4 miles.    │  DONE                               │
│  Had lunch with Alex from        │  ☑ Finish portfolio homepage   98%  │
│  OpenAI, he'll intro me to       │    → milestone "Deployed" reached   │
│  their design lead. Didn't get   │  ☑ Workout                     95%  │
│  to the resume. Spent about $60  │    → 4 mi · 3 of 3 this week        │
│  on dinner. Feeling good but a   │  ☐ Send proposal to Alex       41%  │
│  bit stretched between the       │    low confidence — left unchecked  │
│  startup and the job search.     │                                     │
│                                  │  NOT DONE                           │
│                            🎤    │  ○ Update resume    → tomorrow  ⌄   │
│                                  │                                     │
│  ──────────────────────────────  │  NEW                                │
│  Or check them off yourself:     │  + 👤 Alex · OpenAI                 │
│  ☑ Finish portfolio homepage     │  + ⏳ Intro to design lead          │
│  ☑ Workout                       │  + 💰 $60 dinner                    │
│  ☐ Send proposal to Alex         │  + 📓 Journal entry                 │
│  ☐ Call Sarah                    │                                     │
│  ☐ Update resume                 │  Today 4 of 5 · Career 68 → 72%     │
│                                  │                                     │
│                                  │  [ Confirm ]   ⌘↵                   │
└──────────────────────────────────┴─────────────────────────────────────┘
```

Left column: you write or dictate. Right column: what the system understood, updating live as you type after a short debounce. Beneath the writing area, the plain manual checklist is always present — you can ignore the text box entirely and just click checkboxes; the two stay in sync.

This side-by-side arrangement is only possible on a wide canvas, and it's what makes the interaction trustworthy: you see the match happening next to the sentence that caused it, so you can fix the sentence rather than hunting for a wrong object afterward.

### 4.2 Match confidence

| Score | Presentation | Default |
|---|---|---|
| ≥ 0.85 | Checked, green, effect shown beneath | Completes on Confirm |
| 0.50–0.84 | Unchecked, amber, match named | Stays open unless you check it |
| < 0.50 | Not offered as a match | Becomes a new object |

Signals: semantic similarity between your text and open item titles (weighted toward Today and Doing), completion verbs ("finished," "sent," "pushed," "ran," "called"), numeric extraction for habits ("4 miles" → value 4, unit mi), and recency.

### 4.3 What Confirm does

Completes checked items with timestamps · logs activity rows · advances milestones · recalculates project and goal progress · logs habit metrics · creates new objects and edges · records the expense · saves the raw text as a journal entry with mood and themes · snoozes not-done items to tomorrow by default.

Then the modal replaces itself with a compact summary for three seconds:

```
4 of 5 done · "Deployed" milestone reached · Career +4%
1 new person · 1 journal entry · Health 3 of 3 this week
```

### 4.4 Optional prompts

Collapsed below Confirm: **How are you feeling?** (five states plus free text) and **Anything for tomorrow?** Both feed the personal model and tomorrow's Home. Skipping is normal and never nagged.

### 4.5 Missing a day

Nothing breaks. Items roll over at midnight tagged "carried over." Opening Debrief the next day offers "Also log yesterday?" with yesterday's open items listed.

### 4.6 Narrower widths

**Tablet.** Columns stack: writing area, then match card, then manual checklist.
**Phone.** Full-screen route rather than a modal, same stacked order, sticky Confirm bar.

---

## 5. SCREEN — Goals (`/goals`)

Three sub-views as tabs: **Tree · Roadmap · Drift.**

### 5.1 Tree (`/goals/tree`)

Tree in the main pane, selected goal's detail in the context pane. Walking the hierarchy never loses your place.

```
┌─────────────────────────────────────────────┬────────────────────────────┐
│  GOALS       Tree │ Roadmap │ Drift          │  Get a design eng. role    │
│                                              │  3 months · due 1 Dec      │
│  "Build ambitious things, stay free,         │  Career · on track         │
│   stay connected."                    [edit] │                            │
│                                              │  ████████░░ 72%            │
│  ▾ CAREER                        72%  ↑4     │      ╱‾‾‾                  │
│    ▾ 5y  Build a company         40%         │   ╱‾‾                      │
│      ▾ 1y  $250K / launch        55%  behind │ ‾                          │
│        ▾ 3m  Get a design role   72%  ●      │ Jun  Jul  Aug  Sep         │
│            ○ 1m  Apply to 10     4/10        │                            │
│            ○ 1w  2 applications  1/2         │  WHY                       │
│          ▸ Portfolio        ██████████ 100%  │  Supports 1y $250K income  │
│          ▸ Job search       ████░░░░░░  40%  │  → 5y Build a company      │
│      ▸ 3m  Reach $10K MRR        30%         │                            │
│                                              │  PROJECTS                  │
│  ▾ FINANCE                       63%  ↑2     │  ✓ Portfolio         100%  │
│    ▸ 5y  $1M by 35         63%  on track     │  ▸ Job search         40%  │
│    ▸ 1y  Invest $75K       41%  −$4K         │                            │
│                                              │  THIS WEEK                 │
│  ▸ HEALTH                        48%  →      │  ○ Send proposal to Alex   │
│  ▸ RELATIONSHIPS                 55%  ↑1     │  ○ Update resume           │
│  ▸ LEARNING                      70%  ↑6     │                            │
│                                              │  PEOPLE  Sarah · Alex      │
│  + Add goal                                  │  REFLECTIONS  3 entries    │
│                                              │                            │
│                                              │  ✦ Build roadmap · Metric  │
└─────────────────────────────────────────────┴────────────────────────────┘
```

**Interactions.** Click a chevron to expand or collapse; state persists. Click a row to load it in the context pane. Drag a goal onto another to reparent it, or onto a horizon header to change its horizon. Right-click for archive, mark done, change horizon, add child. Hovering a row shows a `+` to add a child inline.

**Progress and trajectory.** Each row shows rolled-up percentage, a seven-day delta arrow, and a trajectory word (on track / behind / ahead) computed from progress against elapsed time to deadline.

**Adding a goal.** `+ Add goal` focuses an inline field. Type a sentence — "I want $1M invested by 35" — and the AI fills horizon, area, parent, metric, target, and deadline as dashed-underline suggestions in the context pane. Adjust anything, or `⌘↵` to accept.

### 5.2 Roadmap (`/goals/roadmap`)

A real Gantt — precisely the view that justifies a desktop-first design.

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ROADMAP     Week │ Month │ Quarter │ Year │ 5 Years        ← 2026 → 2027   │
│                                                                             │
│                  Sep      Oct      Nov      Dec      Jan      Feb      Mar  │
│  load            ▓▓▓░     ▓▓▓▓     ▓▓▓▓▓    ▓▓░░     ▓▓░░     ▓░░░     ▓▓░░ │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Portfolio       ████◆                                                      │
│  Job search           ████████◆████◆                                        │
│  Customer intv   ██████████◆                                                │
│  Product launch       ████████████◆████                                     │
│  Marathon prep             ██████████████████◆                              │
│  Move NYC                                    ████████◆████                  │
│  Europe trip                                                      ████      │
└────────────────────────────────────────────────────────────────────────────┘
```

Bars are projects; diamonds are milestones. The **load** strip shades each period by committed hours against available calendar time, so an overcommitted November is visible before you live it. Drag a bar horizontally to reschedule — contained milestones and tasks shift proportionally, with undo. Drag a bar's edge to extend or compress. Click a bar to open the project in the context pane. Hover a diamond for its name and date.

Zoom changes the column unit: Week → days, Month → weeks, Quarter → months, Year → months, 5 Years → quarters.

At tablet width the roadmap keeps horizontal scroll with a sticky label column. On phone it becomes a vertical list grouped by month — each project a row with a date range and progress bar. Same information, no bars.

### 5.3 Drift (`/goals/drift`)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  GOAL DRIFT                                          September 2026  ⌄     │
│                                                                             │
│  What you said matters        vs.        Where your effort went             │
│                                                                             │
│  1  Career        ████████████░░░░  38%   ← stated #1, actual #1  ✓         │
│  2  Finance       ██████████░░░░░░  31%   ← stated #2, actual #2  ✓         │
│  3  Health        ███░░░░░░░░░░░░░   9%   ← stated #3, actual #5  ⚠         │
│  4  Relationships █████░░░░░░░░░░░  14%   ← stated #4, actual #3            │
│     Unlinked      ███░░░░░░░░░░░░░   8%                                     │
│                                                                             │
│  Health is your third priority and received 9% of your effort this month.   │
│  It has also been flat for 23 days.                                         │
│                                                                             │
│  [ That's intentional ]     [ Rebalance next month → ]                      │
└────────────────────────────────────────────────────────────────────────────┘
```

Effort comes from the activity log: completed tasks and milestones weighted by estimated time, grouped by the area of the goal they support. Clicking any bar opens the underlying completions in the context pane, so every number is auditable.

---

## 6. SCREEN — Work (`/work`)

Tabs: **Board · Projects · Backlog · Waiting.**

### 6.1 Board (`/work/board`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  WORK   Board │ Projects │ Backlog │ Waiting      Lens: All ⌄   ⚲ Filter  │
│                                                                           │
│  BACKLOG 12   NEXT 7      TODAY 5     DOING 1     WAITING 3    DONE 24    │
│  ┌─────────┐  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │Research │  │Update   │ │Homepage │ │Proposal │ │Sarah    │ │Homepage│ │
│  │NYC      │  │resume   │ │Career   │ │to Alex  │ │feedback │ │  ✓     │ │
│  │         │  │↻ 3 wks  │ │1:30p ⚡3│ │due tmw  │ │6 days   │ │        │ │
│  ├─────────┤  ├─────────┤ ├─────────┤ └─────────┘ ├─────────┤ ├────────┤ │
│  │Learn    │  │Shortlist│ │Call     │             │Ben intro│ │Workout │ │
│  │Spanish  │  │10 cos   │ │Sarah    │             │12 days  │ │  ✓     │ │
│  │         │  │🔒blocked│ │51 days  │             │ nudge?  │ │        │ │
│  ├─────────┤  ├─────────┤ ├─────────┤             └─────────┘ └────────┘ │
│  │  …      │  │  …      │ │Workout  │                                     │
│  └─────────┘  └─────────┘ └─────────┘                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

Six columns visible at once on a wide screen — the reason this is a web app. Drag cards between columns to change status; dropping into Today generates the "why" line automatically. Cards show title, goal chip, schedule, a ⚡ badge counting what this unblocks, and 🔒 if blocked (hover names the blocker).

**Lens** filters the same underlying tasks by area, goal, or project. Switching lenses never duplicates data; it's one set viewed differently.

**Multi-select.** Shift-click or ⌘-click cards, then a floating bar offers: move to column, set priority, link to goal, schedule, delete. Bulk editing matters when reorganizing after a monthly reset.

At tablet width, three columns with h-scroll and sticky headers. On phone the board becomes a segmented control (Today · Next · Doing · Waiting · Backlog · Done) showing one column as a vertical list.

### 6.2 Projects (`/work/projects`)

A table on wide screens, since tables are what desktops are for:

| Project | Goal | Progress | Next milestone | Open | Due | Load |
|---|---|---|---|---|---|---|
| Product launch | Career | ████████░░ 80% | Onboarding flow · 12 Sep | 6 | 30 Sep | 8h/wk |
| Job search | Career | ████░░░░░░ 40% | 10 applications · 1 Oct | 3 | 1 Dec | 4h/wk |
| Marathon prep | Health | ██░░░░░░░░ 22% | 10-mile run · 20 Oct | 4 | 15 Mar | 6h/wk |

Sortable by any column. Click a row for the context pane; click the name for the full route. A collapsed "Parked" section sits at the bottom. On phone the table becomes stacked cards.

### 6.3 Project detail (`/work/projects/:id`)

Main pane holds milestones and tasks as nested, checkable, drag-reorderable lists. Context pane holds metadata.

```
┌──────────────────────────────────────────────┬───────────────────────────┐
│  ← Work                                       │  Job search               │
│  Job search                                   │  Career → Design role     │
│  ████░░░░░░ 40% · 3 open · 1 blocked          │  Due 1 Dec · 4h/wk        │
│                                               │                           │
│  ◆ Portfolio live                    ✓ 3 Sep  │  PEOPLE                   │
│                                               │  Sarah · Alex · Jake      │
│  ◇ 10 applications sent            due 1 Oct  │                           │
│    ☑ Update resume                            │  WAITING ON               │
│    ☐ Shortlist 10 companies      🔒 blocked   │  Sarah — feedback   6d    │
│    ☐ Write cover letter template              │                           │
│    ☐ Apply ×10                        0/10    │  FILES                    │
│    + Add task                                 │  resume_v4.pdf            │
│                                               │  cover_letter.md          │
│  ◇ 3 interviews                    due 1 Nov  │                           │
│  ◇ Offer                           due 1 Dec  │  DECISIONS   none         │
│                                               │                           │
│  + Add milestone                              │  ACTIVITY                 │
│                                               │  3 Sep  Portfolio live    │
│                                               │  2 Sep  Added Alex        │
│                                               │                           │
│                                               │  ✦ Break down · Estimate  │
│                                               │    load · Reschedule      │
└──────────────────────────────────────────────┴───────────────────────────┘
```

Typing at the end of any milestone adds a task inline. Dragging a task between milestones reassigns it. **Break down** regenerates the milestone structure from the description while preserving completed items.

### 6.4 Backlog and Waiting

**Backlog** is five drag-between sections — Now · Next · Later · Someday · Maybe — each item showing its age. Items older than a year get an inline chip: *"Saved 18 months ago. Still interested?"* with Keep / Promote / Archive.

**Waiting** is a table: person, what you're waiting for, days elapsed, and inline Nudge / Received buttons. Nudge opens a pre-drafted message in Drafts.

---

## 7. SCREEN — Task detail (context pane)

Opens beside whatever list you clicked from. Never a modal on desktop.

```
┌───────────────────────────────┐
│  ○ Send proposal to Alex   ✕  │
│                                │
│  Unblocks Job search → Career  │
│                                │
│  Due       Tomorrow        ⌄   │
│  Schedule  1:30–2:00 ✓ free ⌄  │
│  Project   Job search      ⌄   │
│  Goal      Design role     ⌄   │
│  Person    Alex            ⌄   │
│  Priority  High            ⌄   │
│  Estimate  30 min          ⌄   │
│  Energy    Focus           ⌄   │
│  Repeat    —               ⌄   │
│  Blocks    Shortlist companies │
│                                │
│  Notes                         │
│  ┌────────────────────────────┐│
│  │ Include the Q3 numbers…    ││
│  └────────────────────────────┘│
│                                │
│  📎 proposal_draft.pdf         │
│                                │
│  ✦ Break down · Draft it ·     │
│    Find a time                 │
│                                │
│  [ Complete ]  Snooze  Someday │
└───────────────────────────────┘
```

Every field is click-to-edit. Dashed underlines mark AI-inferred values not yet confirmed; any interaction confirms them. Nothing is required — a task with only a title is valid forever.

On phone this becomes a full-screen route with a back button.

---

## 8. SCREEN — Brain (`/brain`)

Two-pane by nature: stream left, editor right.

```
┌──────────────────────────────┬─────────────────────────────────────────────┐
│  BRAIN              ⚲ Filter │  3 September 2026                           │
│  All Journal Thoughts Notes  │  ─────────────────────────────────────────  │
│  Drafts Ideas Decisions Saves│                                             │
│                              │  Good day overall. Finished the homepage    │
│  TODAY                       │  and it feels good to have it shipped.      │
│  📓 "Good day overall…"  ●   │  Worried I'm spreading myself thin between  │
│  💭 Startup idea: agent…     │  the startup and the job search — I keep    │
│  🔗 Personal knowledge graphs│  saying I'll focus and then don't.          │
│                              │                                             │
│  YESTERDAY                   │                                             │
│  📝 Interview prep           │  ─────────────────────────────────────────  │
│  ✉️ Draft: text to Sarah     │  ✦ REFLECTION                          ⌄    │
│  ⚖️ Decision: no NYC         │  "Spreading thin" appears in 4 entries this │
│                              │  month. It correlates with weeks where you  │
│  1 SEPTEMBER                 │  have more than 6 active projects.          │
│  📓 "Slow start…"            │  Related: Focus recommendation · Career goal│
│  ❝ Quote from The Mom Test   │  Turn into → Goal · Task · Decision · none  │
│                              │                                             │
│  ─────────────────────────   │                                             │
│  PATTERNS                    │                                             │
│  "spreading thin"      4× ↑  │                                             │
│  "design"       19× / 6 mo   │                                             │
│  "financial security"  9×    │                                             │
└──────────────────────────────┴─────────────────────────────────────────────┘
```

The stream is filterable by type and searchable. The editor is wide, clean, and autosaving. Journal entries are stored verbatim; the reflection panel is collapsed by default and never rewrites what you wrote.

**Notes** use a block editor with `@` mentions that create real graph edges. **Drafts** carry a recipient and open with an assistant toolbar: Improve · Shorter · Warmer · Professional · Casual · Clearer · Sound like me. **Ideas** get a pipeline (Raw → Exploring → Validating → Building → Shipped/Parked) as a small board. **Decisions** are structured: decision, date, reasoning, alternatives, revisit date. **Saves** render as a grid with AI cluster chips above.

On phone, stream and editor become separate routes.

---

## 9. SCREEN — People (`/people`)

Table on the left, person detail on the right.

| Person | Company | Last | Cadence | Status |
|---|---|---|---|---|
| Sarah Chen | Anthropic | 51d | 30d | ⚠ overdue · 🎂 tomorrow |
| Ben Ortiz | Figma | 40d | 45d | waiting on intro |
| Alex Kim | OpenAI | today | — | new |
| Jake Liu | Anthropic | 3d | 21d | ok |

Default sort is reach-out priority. The detail pane shows relationship memory: how you met, who introduced you, what you've discussed, people in common, the interaction timeline, linked goals and projects, and open waiting-on items. **Log interaction** opens capture pre-filled with `@Sarah — `. **Draft message** opens Drafts with context and a voice-matched draft.

---

## 10. SCREEN — Library (`/library`)

Tabs: Books · Media · Articles · Places · Interests. Grid of covers on wide screens with status grouping (Want · In progress · Done); list toggle available. Detail pane shows notes, quotes, key ideas, who recommended it, and the linked interest. Interests are cards with an item count and a 30-day sparkline, each with "Make this a goal."

---

## 11. SCREEN — Life (`/life`)

Chronological timeline in the main pane, filters in the context pane.

```
┌────────────────────────────────────────────┬──────────────────────┐
│  LIFE          Day │ Month │ Year          │  FILTERS             │
│                                            │  ☑ Milestones        │
│  SEPTEMBER 2026                            │  ☑ Experiences       │
│  ●  3 Sep   ◆ Portfolio live               │  ☑ Decisions         │
│             Met Alex · 4 mi run            │  ☑ People            │
│             Journal · $60 dinner           │  ☐ Journal           │
│                                            │  ☐ Money             │
│  ●  2 Sep   AI meetup                      │  ☐ Media             │
│             Met Sarah, Jake                │                      │
│             ⚖ Decision: no NYC this year   │  AREA   All ⌄        │
│                                            │                      │
│  ●  1 Sep   Journal · 2 books added        │  PERSON Anyone ⌄     │
│                                            │                      │
│  AUGUST 2026                          ▸    │                      │
└────────────────────────────────────────────┴──────────────────────┘
```

Year view compresses to a heat strip per life area — twelve columns, one row per area, shaded by activity. Clicking a cell drills into that month.

---

## 12. SCREEN — Money (`/money`)

Tabs: Overview · Spending · Goals · What-if · Accounts.

**Overview** is a metric grid on wide screens — net worth, cash, investments, debt, income, spending, savings rate, each with a delta and sparkline — above financial goals with progress bars and trajectory badges. Clicking a metric opens its breakdown in the context pane.

**Spending** shows a month picker, category bars against three-month averages, an anomalies list, a subscriptions panel with "last mentioned" per item, and a transactions table with inline recategorization.

**Goals** shows each financial goal with current, target, date, required monthly, actual monthly, projected outcome, and editable assumptions. A **Reality check** toggle switches the copy to direct language and surfaces the lever list.

**What-if** is a text field plus saved scenarios with side-by-side comparison. Results show cash, runway, savings rate, and each goal's revised date.

---

## 13. SCREEN — Memory (`/memory`)

The personal model, inspectable and correctable. Categories in the pane sidebar, facts in the main area:

```
PATTERNS                                                          5 facts

●  You tend to stall on goals that require more than 5 hours a week.
   confidence 78% · 4 sources · updated 20 Aug
   [Right] [Wrong] [Changed] [Make private] [Forget]
   ▸ sources: journal 12 Jun · goal "Learn piano" · goal "Marathon 2025" · journal 3 Aug

●  You do your best focused work between 1pm and 4pm.
   confidence 64% · 11 sources · updated 28 Aug
```

Every fact exposes its evidence; clicking a source opens it in the context pane. A free-text box — "What do you think you know about me?" — returns a conversational summary you can correct in plain language.

---

## 14. SCREEN — Reviews (`/review`)

**Weekly** (Sundays) is a single scrollable page: numbers, goal deltas, observations, postponed items with Do/Park/Drop chips, and one question — "What should change next week?" Two minutes.

**Monthly reset** is the one place a wizard is right: a centered modal, one step per screen, progress rail down the left. Steps: what happened → what mattered → goals by horizon (each Keep/Edit/Done/Drop) → projects → backlog → money → next month. Ten minutes, every step skippable.

**Annual** is a generated, shareable page: stats, charts, themes, people, places, decisions, accomplishments, lessons, the "wanted but haven't done" list, and a "how you changed" narrative.

---

## 15. Responsive summary by screen

| Screen | Wide (≥1440) | Tablet (768–1023) | Phone (<768) |
|---|---|---|---|
| Home | 3 panes | Signals inline as cards | Single column, tab bar |
| Capture | 640px modal | 640px modal | Full-screen sheet |
| Debrief | 2-column modal | Stacked modal | Full-screen route |
| Goal tree | Tree + detail | Tree, detail as drawer | Depth 2, detail route |
| Roadmap | 12-month Gantt | 6-month, sticky labels | Vertical list by month |
| Board | 6 columns | 3 columns, h-scroll | Segmented, one column |
| Projects | Sortable table | Table, fewer columns | Stacked cards |
| Brain | Stream + editor | Stream, editor drawer | Separate routes |
| People | Table + detail | Table, detail drawer | List, detail route |
| Money | Metric grid + detail | 2-col grid | Stacked metrics |
| Reviews | Full page | Full page | Full page, stacked |

---

## 16. Visual system

**Type.** One sans for the interface (Inter or similar), one serif for journal and long-form reading. Interface scale: 12 / 13 / 14 / 16 / 20 / 28. Journal body at 18px with generous line height.

**Density.** Comfortable by default; a compact toggle in settings reduces row heights roughly 20% for people who want more on screen.

**Color.** Neutral greyscale foundation. One accent for interactive elements. Semantic colors used sparingly: green for reached and on-track, amber for behind and attention, red only for genuinely overdue. Life areas each get a muted hue used only in chips and charts, never as backgrounds.

**Motion.** Fast and functional. 150ms for hovers and inline transitions, 250ms for pane and drawer movement, 400ms for completion animations. Respect `prefers-reduced-motion`.

**Dark mode.** Full support, system-following by default.

**Accessibility.** WCAG AA contrast throughout. Every interaction reachable by keyboard. Focus rings visible and never suppressed. ARIA live regions announce progress changes and undo toasts. Drag operations have keyboard equivalents via the right-click menu.

---

## 17. The daily loop, on the web

**7:30am, laptop.** Open the tab. `G H`. Read Today and the periphery in one screen without scrolling. Maybe `S` to snooze one item. Sixty seconds.

**1:30pm.** The tab is already open. Home has shifted to afternoon state: "45 minutes free — the homepage fits." Thirty seconds.

**9:30pm.** `D`. Type a paragraph about the day. Watch the right column fill in as you type. Glance at the matches, uncheck nothing, `⌘↵`. Summary: 4 of 5, Career +4%. Two minutes.

**Phone, midday.** Same app in the browser, or installed as a PWA. Capture from the share sheet, check one thing off, close it.

Everything else — the tree, the roadmap, the drift analysis, the money dashboard — is there when you want to sit down and think, and out of the way when you don't.
