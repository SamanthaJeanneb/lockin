---
version: 2.0
name: life-os-design
description: "A fully monochrome application design system for a dense, keyboard-driven personal operating system. There is no accent color anywhere in the interface. Hierarchy is carried entirely by a neutral surface ladder, 1px hairlines, type weight, and whitespace. The only chromatic pixels in the entire product appear inside charts and progression indicators — nowhere else. Montserrat at 600/700 sets all headings; Outfit at 400/500 sets all body, UI, and reading copy. Light and dark are equal first-class themes driven by a single token file. Every style lives in one place: components consume semantic CSS variables and never hardcode a value. Corners cap at 8px. Shadows appear only on overlays. Sections are separated by space and rules, never wrapped in cards."

# ═══════════════════════════════════════════════════════════════
# COLOR
# There is no accent. The interface is greyscale.
# Chromatic values exist ONLY under `data:` and are permitted
# ONLY inside charts and progression indicators.
# ═══════════════════════════════════════════════════════════════

colors:
  # ── Action (monochrome) ───────────────────────────────────
  action: "#171717"
  action-hover: "#000000"
  action-pressed: "#2b2b2b"
  on-action: "#ffffff"

  # ── Surface (light) ───────────────────────────────────────
  canvas: "#ffffff"
  surface-1: "#fafafa"
  surface-2: "#f4f4f4"
  surface-3: "#ebebeb"
  surface-inset: "#f7f7f7"
  selection: "#e4e4e4"
  scrim: "#1717170f"

  # ── Hairline (light) ──────────────────────────────────────
  hairline: "#e6e6e6"
  hairline-strong: "#d4d4d4"
  hairline-focus: "#b3b3b3"

  # ── Ink (light) ───────────────────────────────────────────
  ink: "#171717"
  ink-muted: "#5c5c5c"
  ink-subtle: "#8a8a8a"
  ink-faint: "#b0b0b0"
  ink-disabled: "#c9c9c9"

  # ── Surface (dark) ────────────────────────────────────────
  dark-canvas: "#0e0e0e"
  dark-surface-1: "#161616"
  dark-surface-2: "#1c1c1c"
  dark-surface-3: "#242424"
  dark-surface-inset: "#121212"
  dark-selection: "#2e2e2e"
  dark-scrim: "#00000080"

  # ── Hairline (dark) ───────────────────────────────────────
  dark-hairline: "#272727"
  dark-hairline-strong: "#363636"
  dark-hairline-focus: "#4d4d4d"

  # ── Ink (dark) ────────────────────────────────────────────
  dark-ink: "#ededed"
  dark-ink-muted: "#a1a1a1"
  dark-ink-subtle: "#757575"
  dark-ink-faint: "#4f4f4f"
  dark-ink-disabled: "#3a3a3a"

  # ── Action (dark) ─────────────────────────────────────────
  dark-action: "#ededed"
  dark-action-hover: "#ffffff"
  dark-action-pressed: "#c9c9c9"
  dark-on-action: "#0e0e0e"

# ═══════════════════════════════════════════════════════════════
# DATA COLOR
# The ONLY chromatic values in the product.
# Permitted surfaces: chart series, chart legends, trajectory
# indicators, 6px category dots, sparklines.
# Forbidden everywhere else: no buttons, no borders, no fills,
# no backgrounds, no icons, no text outside a chart or a
# trajectory label.
# ═══════════════════════════════════════════════════════════════

data:
  # Progression / trajectory
  track-ahead: "#3f8f5f"
  track-on: "#3f8f5f"
  track-behind: "#a8792f"
  track-overdue: "#b4544c"
  track-none: "#8a8a8a"

  # Category series — desaturated earth and slate, max ~35% sat
  series-1: "#5b7c99"
  series-2: "#6f8f6a"
  series-3: "#a8785c"
  series-4: "#9c7b6e"
  series-5: "#7a8794"
  series-6: "#a89a68"
  series-7: "#6d8c8c"
  series-8: "#8f8577"
  series-9: "#7f8a7a"
  series-10: "#8a8a8a"

  # Dark-theme variants (~15% lighter)
  dark-track-ahead: "#4fa570"
  dark-track-on: "#4fa570"
  dark-track-behind: "#c9953f"
  dark-track-overdue: "#cf675e"
  dark-track-none: "#757575"
  dark-series-1: "#7196b3"
  dark-series-2: "#87a882"
  dark-series-3: "#c19175"
  dark-series-4: "#b59387"
  dark-series-5: "#93a0ad"
  dark-series-6: "#c0b280"
  dark-series-7: "#85a5a5"
  dark-series-8: "#a89e90"
  dark-series-9: "#98a393"
  dark-series-10: "#a1a1a1"

# ═══════════════════════════════════════════════════════════════
# TYPOGRAPHY
# Montserrat 600/700 → headings only, ≥16px only.
# Outfit 400/500    → everything else, including reading copy.
# ═══════════════════════════════════════════════════════════════

typography:
  display:
    fontFamily: Heading Sans
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: -0.8px
  title:
    fontFamily: Heading Sans
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.24
    letterSpacing: -0.6px
  heading:
    fontFamily: Heading Sans
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: -0.3px
  heading-sm:
    fontFamily: Heading Sans
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: -0.25px
  subheading:
    fontFamily: Body Sans
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.40
    letterSpacing: -0.05px
  body:
    fontFamily: Body Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: -0.05px
  body-sm:
    fontFamily: Body Sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0
  caption:
    fontFamily: Body Sans
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.40
    letterSpacing: 0
  micro:
    fontFamily: Body Sans
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.30
    letterSpacing: 0.2px
  button:
    fontFamily: Body Sans
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.20
    letterSpacing: 0
  numeric:
    fontFamily: Body Sans
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.30
    letterSpacing: 0
    fontVariantNumeric: tabular-nums
  numeric-lg:
    fontFamily: Heading Sans
    fontSize: 26px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.6px
    fontVariantNumeric: tabular-nums
  read-body:
    fontFamily: Body Sans
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: 0
  read-heading:
    fontFamily: Heading Sans
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.30
    letterSpacing: -0.5px
  mono:
    fontFamily: Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0

rounded:
  xs: 3px
  sm: 4px
  md: 6px
  lg: 8px
  full: 9999px

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  section: 48px

sizing:
  row-compact: 30px
  row-comfortable: 36px
  control-sm: 26px
  control-md: 30px
  control-lg: 34px
  sidebar: 240px
  sidebar-rail: 56px
  context-pane: 360px
  context-pane-min: 320px
  context-pane-max: 520px
  top-bar: 48px
  icon: 16px
  icon-sm: 14px
  avatar: 22px
  hairline-width: 1px
  focus-ring-width: 2px
  focus-ring-offset: 2px
  read-measure: 680px

shadows:
  none: none
  drag: "0 4px 12px #17171714"
  popover: "0 4px 16px #1717171a, 0 0 0 1px #17171708"
  modal: "0 16px 48px #17171724, 0 0 0 1px #17171710"
  dark-drag: "0 4px 12px #00000059"
  dark-popover: "0 4px 16px #00000073, 0 0 0 1px #363636"
  dark-modal: "0 16px 48px #00000099, 0 0 0 1px #363636"

motion:
  instant: 90ms
  fast: 120ms
  base: 180ms
  slow: 220ms
  progress: 400ms
  ease: cubic-bezier(0.2, 0, 0, 1)
  ease-pane: cubic-bezier(0.32, 0.72, 0, 1)

components:
  button-primary:
    background: "{colors.action}"
    color: "{colors.on-action}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "{sizing.control-md}"
    padding: 0 12px
    border: none
  button-secondary:
    background: "{colors.canvas}"
    color: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "{sizing.control-md}"
    padding: 0 12px
    border: 1px solid {colors.hairline-strong}
  button-ghost:
    background: transparent
    color: "{colors.ink-muted}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "{sizing.control-md}"
    padding: 0 8px
    border: none
  button-icon:
    background: transparent
    color: "{colors.ink-subtle}"
    rounded: "{rounded.sm}"
    height: "{sizing.control-sm}"
    width: "{sizing.control-sm}"
    border: none
  button-danger:
    background: transparent
    color: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "{sizing.control-md}"
    padding: 0 12px
    border: 1px solid {colors.hairline-strong}
  input:
    background: "{colors.canvas}"
    color: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "{sizing.control-md}"
    padding: 0 10px
    border: 1px solid {colors.hairline-strong}
  input-focus:
    border: 1px solid {colors.hairline-focus}
    outline: 2px solid {colors.ink}
    outlineOffset: 2px
  field-inline:
    background: transparent
    color: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 2px 4px
    border: none
  field-inline-hover:
    background: "{colors.surface-2}"
  field-inline-inferred:
    color: "{colors.ink-muted}"
    borderBottom: 1px dashed {colors.hairline-focus}
  sidebar:
    background: "{colors.surface-1}"
    color: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    width: "{sizing.sidebar}"
    borderRight: 1px solid {colors.hairline}
  sidebar-item:
    background: transparent
    color: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    height: "{sizing.control-md}"
    padding: 0 8px
  sidebar-item-active:
    background: "{colors.surface-3}"
    color: "{colors.ink}"
    typography: "{typography.subheading}"
  top-bar:
    background: "{colors.canvas}"
    color: "{colors.ink}"
    typography: "{typography.body-sm}"
    height: "{sizing.top-bar}"
    borderBottom: 1px solid {colors.hairline}
  context-pane:
    background: "{colors.canvas}"
    color: "{colors.ink}"
    typography: "{typography.body-sm}"
    width: "{sizing.context-pane}"
    borderLeft: 1px solid {colors.hairline}
    padding: "{spacing.lg}"
  row:
    background: transparent
    color: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: "{sizing.row-comfortable}"
    padding: 0 8px
    borderBottom: 1px solid {colors.hairline}
  row-hover:
    background: "{colors.surface-1}"
  row-selected:
    background: "{colors.surface-2}"
  row-done:
    color: "{colors.ink-faint}"
    textDecoration: line-through
  card:
    background: "{colors.canvas}"
    color: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 10px 12px
    border: 1px solid {colors.hairline}
  card-dragging:
    border: 1px solid {colors.hairline-strong}
    shadow: "{shadows.drag}"
  board-column:
    background: transparent
    color: "{colors.ink-subtle}"
    typography: "{typography.micro}"
    width: 280px
    border: none
  tree-row:
    background: transparent
    color: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    height: "{sizing.row-compact}"
    padding: 0 6px
  progress-track:
    background: "{colors.surface-3}"
    rounded: "{rounded.full}"
    height: 4px
  progress-fill:
    background: "{colors.ink}"
    rounded: "{rounded.full}"
    height: 4px
  roadmap-bar:
    background: "{colors.surface-3}"
    color: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    height: 20px
  roadmap-bar-fill:
    background: "{colors.ink}"
    rounded: "{rounded.sm}"
  roadmap-milestone:
    background: "{colors.ink}"
    width: 8px
    height: 8px
  chip:
    background: "{colors.surface-2}"
    color: "{colors.ink-muted}"
    typography: "{typography.micro}"
    rounded: "{rounded.xs}"
    height: 18px
    padding: 1px 6px
  chip-track:
    background: transparent
    color: "{data.track-none}"
    typography: "{typography.micro}"
    padding: 0
  table-header:
    background: "{colors.canvas}"
    color: "{colors.ink-subtle}"
    typography: "{typography.micro}"
    height: "{sizing.row-compact}"
    borderBottom: 1px solid {colors.hairline-strong}
  table-row:
    background: transparent
    color: "{colors.ink}"
    typography: "{typography.body-sm}"
    height: "{sizing.row-comfortable}"
    borderBottom: 1px solid {colors.hairline}
  metric:
    background: transparent
    color: "{colors.ink}"
    typography: "{typography.numeric-lg}"
    padding: "{spacing.md} 0"
  modal:
    background: "{colors.canvas}"
    color: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
    border: 1px solid {colors.hairline}
    shadow: "{shadows.modal}"
  palette:
    background: "{colors.canvas}"
    color: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
    border: 1px solid {colors.hairline}
    shadow: "{shadows.modal}"
  menu:
    background: "{colors.canvas}"
    color: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "{spacing.xs}"
    border: 1px solid {colors.hairline}
    shadow: "{shadows.popover}"
  toast:
    background: "{colors.action}"
    color: "{colors.on-action}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 10px 14px
    shadow: "{shadows.popover}"
  segmented:
    background: "{colors.surface-2}"
    color: "{colors.ink-subtle}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "{sizing.control-md}"
    padding: 2px
  segmented-active:
    background: "{colors.canvas}"
    color: "{colors.ink}"
    rounded: "{rounded.sm}"
  reading:
    background: "{colors.canvas}"
    color: "{colors.ink}"
    typography: "{typography.read-body}"
    maxWidth: "{sizing.read-measure}"
    padding: "{spacing.xxl}"
---

## Overview

This is an **application** design system for a dense, keyboard-driven personal operating system — a three-pane shell containing goal hierarchies, kanban boards, twelve-month Gantt charts, sortable tables, and a long-form journal. It is not a marketing system, and no rule here is borrowed from one.

Two decisions define everything else.

**The interface is monochrome.** There is no accent color. Not on buttons, not on links, not on focus rings, not on active states, not on badges. The primary action is near-black ink on white, inverting to near-white on near-black in dark mode. Hierarchy is carried entirely by a four-step neutral surface ladder, 1px hairlines, type weight, and whitespace.

**Color exists only as data.** The `data:` token group is the complete set of chromatic values in the product, and it is permitted on exactly two kinds of surface: chart series and progression indicators. A trajectory word, a 6px legend dot, a bar in the drift chart, a sparkline. Nowhere else. If a screen contains no chart and no progression state, that screen contains no color at all — and most of them don't.

**Key characteristics**

- Zero accent. Greyscale interface, top to bottom.
- Color appears only inside charts and progression indicators.
- Montserrat 600/700 for headings at 16px and above; Outfit 400/500 for everything else.
- Light and dark are equal first-class themes from one token file.
- All styling is centralized. Components read semantic variables and never hardcode values.
- Four-step surface ladder plus 1px hairlines. Shadows only on overlays.
- Corners cap at 8px. Buttons and inputs 6px. Nothing is pill-shaped except avatars.
- Body is 14px. Rows are 30–36px. Density is a feature.
- Sections separate by whitespace and hairline rules — never wrapped in cards.
- No purple, violet, lavender, indigo, or magenta anywhere, including in tinted greys.

---

## Centralized styling

**All styling lives in one place. This is a hard architectural rule, not a preference.**

### The single source of truth

```
src/styles/tokens.css     ← every value in the system, light + dark
tailwind.config.ts        ← maps tokens to utility names, defines nothing new
src/components/ui/*       ← primitives that consume tokens via utilities
```

Nothing else may define a color, a radius, a shadow, a font size, a duration, or a spacing value. Not a component file, not a page, not an inline style.

### How tokens are structured

Two layers. Primitives hold raw values; semantic tokens reference primitives. **Components only ever reference semantic tokens.**

```css
/* tokens.css */
:root {
  /* Layer 1 — primitives (never used directly in components) */
  --grey-0:   #ffffff;
  --grey-50:  #fafafa;
  --grey-100: #f4f4f4;
  --grey-150: #ebebeb;
  --grey-200: #e6e6e6;
  --grey-300: #d4d4d4;
  --grey-400: #b3b3b3;
  --grey-500: #8a8a8a;
  --grey-600: #5c5c5c;
  --grey-900: #171717;

  /* Layer 2 — semantic (the only names components use) */
  --canvas:          var(--grey-0);
  --surface-1:       var(--grey-50);
  --surface-2:       var(--grey-100);
  --surface-3:       var(--grey-150);
  --hairline:        var(--grey-200);
  --hairline-strong: var(--grey-300);
  --hairline-focus:  var(--grey-400);
  --ink:             var(--grey-900);
  --ink-muted:       var(--grey-600);
  --ink-subtle:      var(--grey-500);
  --ink-faint:       var(--grey-400);
  --action:          var(--grey-900);
  --on-action:       var(--grey-0);
}

[data-theme="dark"] {
  /* Same semantic names, remapped. Components change nothing. */
  --canvas:          #0e0e0e;
  --surface-1:       #161616;
  --surface-2:       #1c1c1c;
  --surface-3:       #242424;
  --hairline:        #272727;
  --hairline-strong: #363636;
  --hairline-focus:  #4d4d4d;
  --ink:             #ededed;
  --ink-muted:       #a1a1a1;
  --ink-subtle:      #757575;
  --ink-faint:       #4f4f4f;
  --action:          #ededed;
  --on-action:       #0e0e0e;
}
```

Dark mode requires no component changes, no conditional classes, and no `dark:` variants in component code. One attribute on `<html>` swaps the whole system.

### Tailwind mapping

```ts
// tailwind.config.ts — maps only. Defines nothing.
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    colors: {
      canvas:    'var(--canvas)',
      surface:   { 1: 'var(--surface-1)', 2: 'var(--surface-2)', 3: 'var(--surface-3)' },
      hairline:  { DEFAULT: 'var(--hairline)', strong: 'var(--hairline-strong)', focus: 'var(--hairline-focus)' },
      ink:       { DEFAULT: 'var(--ink)', muted: 'var(--ink-muted)', subtle: 'var(--ink-subtle)', faint: 'var(--ink-faint)' },
      action:    { DEFAULT: 'var(--action)', on: 'var(--on-action)' },
      track:     { on: 'var(--track-on)', behind: 'var(--track-behind)', overdue: 'var(--track-overdue)', none: 'var(--track-none)' },
      series:    { 1: 'var(--series-1)', /* …through 10 */ },
      transparent: 'transparent',
      current: 'currentColor',
    },
    borderRadius: { xs: '3px', sm: '4px', md: '6px', lg: '8px', full: '9999px' },
    fontFamily: {
      heading: ['var(--font-heading)', 'system-ui', 'sans-serif'],
      body:    ['var(--font-body)', 'system-ui', 'sans-serif'],
      mono:    ['var(--font-mono)', 'ui-monospace', 'monospace'],
    },
    extend: { /* spacing, sizing, shadows — all var() references */ },
  },
};
```

Note what is absent: no `blue`, no `indigo`, no default Tailwind palette. Those keys are removed so `bg-blue-500` is a build error rather than a possibility.

### Rules

1. **No hex in components.** A literal `#` outside `tokens.css` fails lint.
2. **No arbitrary values.** `p-[13px]`, `rounded-[12px]`, `text-[15px]` are forbidden. If a value isn't in the scale, the scale is wrong — fix the scale.
3. **No `dark:` variants in components.** Themes swap at the token layer.
4. **No inline `style` attributes** except for genuinely dynamic geometry: a progress bar's width, a Gantt bar's offset, a chart's computed position.
5. **No CSS-in-JS, no styled-components, no CSS modules.** Utilities that reference tokens, and nothing else.
6. **New value?** Add it to `tokens.css` first, map it in `tailwind.config.ts`, then use it. Never the other way around.

An automated check enforces 1 and 2 in CI.

---

## Component library

A component library is expected. Build it in three tiers, and **build a tier before you use it** — no page composes raw elements when a primitive exists.

### Tier 1 — primitives (`src/components/ui/`)

Every one is themeable, keyboard-accessible, and styled exclusively from tokens.

| Component | Variants | Notes |
|---|---|---|
| `Button` | primary · secondary · ghost · danger | Sizes sm/md/lg. `ghost` is the default choice. |
| `IconButton` | — | 26px square, hover fills surface-2 |
| `Input` | text · number · search | 30px, 6px radius |
| `Textarea` | — | Auto-growing |
| `InlineField` | text · date · select · person · number | The dominant edit pattern. Supports `inferred` state. |
| `Checkbox` | circle · square | Circle for tasks, square for filters |
| `Select` | — | Radix Select, token-styled |
| `Segmented` | — | Tabs and view switchers |
| `Chip` | default · track · category | `category` takes a `series` index for its 6px dot |
| `Avatar` | — | Only full-radius element in the system |
| `Tooltip` | — | Radix, 120ms delay |
| `Menu` | — | Radix DropdownMenu + ContextMenu |
| `Dialog` | — | Radix, sizes sm/md/lg |
| `Drawer` | — | Right-side, tablet context pane |
| `Toast` | — | Bottom-left, 5s, undo action |
| `ProgressBar` | — | 4px, ink fill |
| `Sparkline` | — | 1px, ink stroke |
| `Divider` | — | 1px hairline with configurable clearance |
| `Icon` | — | 16px Lucide wrapper, 1.5px stroke |
| `Kbd` | — | Mono shortcut hint |
| `Skeleton` | — | Surface-2 pulse, no shimmer gradient |
| `EmptyState` | — | One line + one ghost button. No illustration. |

### Tier 2 — composites (`src/components/composite/`)

| Component | Built from | Used by |
|---|---|---|
| `ObjectRow` | Checkbox, Chip, IconButton | Today, lists, search |
| `ObjectCard` | Chip, Avatar | Board |
| `ObjectDetail` | InlineField × n, Button | Context pane, all object types |
| `TreeRow` | Icon, ProgressBar, Chip | Goal tree |
| `DataTable` | sortable, selectable, responsive columns | Projects, people, transactions |
| `Board` | dnd-kit + ObjectCard | Work |
| `Gantt` | roadmap bars, milestones, load strip | Roadmap |
| `Chart` | bar · line · stacked, `series` tokens | Drift, balance, money, analytics |
| `MetricTile` | numeric-lg + Sparkline + trajectory Chip | Money dashboard |
| `CommandPalette` | cmdk + Dialog | Global `⌘K` |
| `CaptureModal` | Dialog + Textarea + ExtractionReview | Global `C` |
| `DebriefModal` | Dialog + Textarea + MatchList | Global `D` |
| `Editor` | Tiptap + MentionMenu | Journal, notes, drafts |
| `SectionHeader` | heading + optional actions + Divider | Everywhere. **Replaces cards.** |

### Tier 3 — shell (`src/components/shell/`)

`AppShell` · `Sidebar` · `TopBar` · `ContextPane` · `BottomTabs`

`ContextPane` owns the docked/drawer/route decision. Views call `contextPane.open(id)` and never check viewport width themselves.

### Principles

- **One component per concept.** There is one `Button`, not `PrimaryButton` and `SecondaryButton`.
- **Variants are props, never new components.**
- **No component accepts a `className` for color, radius, or spacing.** Layout-only overrides.
- **Every primitive ships in Storybook** with light, dark, hover, focus, active, disabled, and loading states.
- **`ObjectRow` and `ObjectDetail` are type-agnostic.** They render a task, a goal, a person, or a book from the same object shape. Adding a new object type requires no new component.

---

## Typography

### Families

```css
--font-heading: 'Montserrat', system-ui, sans-serif;   /* 600, 700 */
--font-body:    'Outfit', system-ui, sans-serif;       /* 400, 500 */
--font-mono:    'Geist Mono', ui-monospace, monospace; /* 400 */
```

Load Montserrat at 600 and 700 only, Outfit at 400 and 500 only. Four weights total, `font-display: swap`, subset to latin.

### The 16px rule

**Montserrat appears at 16px and above. Never below.** It's a wide geometric face; at 13–14px it eats horizontal space and loses legibility in dense rows. Outfit is narrower and holds up small.

The practical split: page titles, section headings, and large metrics are Montserrat. Every row, label, field, button, chip, and paragraph is Outfit. In a typical dense view Montserrat appears once or twice and Outfit does the rest.

Both are geometric sans, so the pairing is quiet by design — the contrast is weight and size, not personality.

### Hierarchy

| Token | Family | Size | Weight | Line height | Tracking | Use |
|---|---|---|---|---|---|---|
| `display` | Montserrat | 28px | 700 | 1.18 | -0.8px | Page title. One per route, often none. |
| `title` | Montserrat | 22px | 700 | 1.24 | -0.6px | Modal title, object title in context pane |
| `heading` | Montserrat | 17px | 600 | 1.35 | -0.3px | Section heading |
| `heading-sm` | Montserrat | 16px | 600 | 1.35 | -0.25px | Sub-section. **Montserrat floor.** |
| `subheading` | Outfit | 14px | 500 | 1.40 | -0.05px | Group label, active nav item |
| `body` | Outfit | 14px | 400 | 1.50 | -0.05px | **Default.** Row titles, form values |
| `body-sm` | Outfit | 13px | 400 | 1.50 | 0 | Context pane, table cells, cards |
| `caption` | Outfit | 12px | 400 | 1.40 | 0 | "Why" line, metadata, timestamps |
| `micro` | Outfit | 11px | 500 | 1.30 | +0.2px | Column headers, chips, counts. Sentence case. |
| `button` | Outfit | 13px | 500 | 1.20 | 0 | All button labels |
| `numeric` | Outfit | 13px | 500 | 1.30 | 0 | Percentages, counts, currency. Tabular. |
| `numeric-lg` | Montserrat | 26px | 700 | 1.15 | -0.6px | Money dashboard metrics. Tabular. |
| `read-body` | Outfit | 17px | 400 | 1.75 | 0 | Journal body. 680px measure. |
| `read-heading` | Montserrat | 22px | 600 | 1.30 | -0.5px | Journal date header |
| `mono` | Geist Mono | 12px | 400 | 1.50 | 0 | Code, IDs, shortcut hints |

### Principles

- **The scale stops at 28px.** There is no 40px, 56px, or 80px. Those belong to landing pages.
- **Montserrat needs negative tracking.** It sets wide by default. -0.8px at 28px, tapering to -0.25px at its 16px floor.
- **Outfit gets almost none.** -0.05px at 14px, zero below.
- **Weight carries hierarchy, not size.** A heading and its body sit one or two steps apart in size and a full step apart in weight.
- **Numbers are always tabular.** Progress percentages and currency must not jitter as they update.
- **Micro labels are sentence case.** "Due date," not "DUE DATE."
- **The journal uses Outfit at 17px / 1.75.** No serif in this system. The shift into reading mode is signalled by measure and line height, not by family.

---

## Color in practice

### The interface is greyscale

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | #ffffff | #0e0e0e | Page, panes, modals, cards |
| `surface-1` | #fafafa | #161616 | Sidebar, row hover |
| `surface-2` | #f4f4f4 | #1c1c1c | Selected row, chips, segmented track |
| `surface-3` | #ebebeb | #242424 | Active nav, progress track, roadmap track |
| `hairline` | #e6e6e6 | #272727 | Dividers, pane borders, card borders |
| `hairline-strong` | #d4d4d4 | #363636 | Input and secondary-button borders |
| `hairline-focus` | #b3b3b3 | #4d4d4d | Dashed underline on inferred values |
| `ink` | #171717 | #ededed | Primary text, primary button fill, progress fill |
| `ink-muted` | #5c5c5c | #a1a1a1 | Secondary text, ghost buttons, nav at rest |
| `ink-subtle` | #8a8a8a | #757575 | Metadata, column headers, icons at rest |
| `ink-faint` | #b0b0b0 | #4f4f4f | Completed text, placeholders |

Greys are true neutrals — no blue, warm, or violet tint at any step.

### Interaction states without color

This is the part that usually tempts people back toward an accent. It isn't necessary.

| State | Treatment |
|---|---|
| Hover (row) | Background → `surface-1` |
| Hover (button ghost/icon) | Background → `surface-2` |
| Hover (button primary) | Background → `action-hover` (#000000) |
| Selected | Background → `surface-2` |
| Active nav | Background → `surface-3`, text → `ink`, weight → 500, 2px `ink` left rule |
| **Focus** | **2px `ink` outline, 2px offset.** Highest-contrast object on screen. |
| Text selection | Background → `selection` (#e4e4e4 / #2e2e2e), text stays `ink` |
| Link | `ink` with 1px underline at `hairline-strong`; hover darkens the underline to `ink` |
| Pressed | Background one surface step darker, 90ms |
| Disabled | Text → `ink-disabled`, no background change, `cursor: not-allowed` |
| Loading | `Skeleton` at `surface-2`, opacity pulse. No shimmer gradient. |
| Drag | `shadows.drag` + `hairline-strong` border, only while dragging |
| Error | 1px `hairline-focus` border + message in `ink` at `caption`. Not red. |

An ink focus ring on white is 16:1 — far more visible than the typical 3:1 blue ring, and it never clashes with the content beneath it.

### Where color IS allowed

Two surfaces. That's the whole list.

**1. Progression indicators.** A trajectory word or dot next to a goal, project, or financial target.

```
Career    ████████░░  72%   ↑4   On track     ← "On track" in track-on
Finance   ██████░░░░  63%   ↑2   Behind       ← "Behind" in track-behind
```

The bar itself is `ink`. Only the word is chromatic, at `micro` size. A colored dot may precede it.

**2. Charts.** Series colors in the drift chart, life-balance bars, spending categories, area sparklines, and trajectory lines. Ten desaturated earth and slate tones, `series-1` through `series-10`, none above ~35% saturation.

Chart chrome stays greyscale: axes are 1px `hairline`, labels are `micro` `ink-subtle`, no gridline fills, no gradients, no shadows.

### Where color is never allowed

Buttons · borders · backgrounds · icons · badges with a colored fill · links · focus rings · nav · headings · body text · error states · a chip background (the 6px dot is the only chromatic pixel in a category chip) · any section background · progress bar fills · roadmap bars.

---

## Layout

### Spacing

Base 4px. `xxs` 2 · `xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 24 · `xxl` 32 · `section` 48.

Applications run tighter than marketing pages. `lg` 16px between content blocks, `xl` 24px between major sections, `section` 48px only above a page title.

### Density

Two user-selectable modes affecting vertical rhythm only. Type sizes never change.

| | Compact | Comfortable (default) |
|---|---|---|
| List / table row | 30px | 36px |
| Tree row | 26px | 30px |
| Sidebar item | 28px | 30px |

### Shell

Top bar 48px · sidebar 240px (rail 56px) · main pane flexible, min 640px · context pane 360px (320–520px).

Panes are distinguished by a 1px hairline and the sidebar's single surface step. They are not cards: no radius, no shadow.

### Whitespace philosophy

**Space and hairlines do what cards would otherwise do.** A section is a `SectionHeader`, 12px of space, and its content. If it needs separation from what follows, a 1px `Divider` with 16px clearance.

It does not get a border, a background, a radius, and 24px of padding. Content wrapped in boxes reads as a template; content organized by rhythm reads as a product. This single rule determines more of the result than any other in this file.

---

## Elevation

| Level | Treatment | Use |
|---|---|---|
| 0 | Nothing | Default. Most of the interface. |
| 1 | Surface step | Row hover, sidebar, zoned regions |
| 2 | 1px hairline | Dividers, pane borders, board cards, tables |
| 3 | `shadows.drag` | A card during an active drag only |
| 4 | `shadows.popover` | Menus, tooltips, toasts |
| 5 | `shadows.modal` + scrim | Dialogs, command palette |

**Shadows mean "this floats and will dismiss."** They never indicate hierarchy within the page. A card in the content area has a 1px border and no shadow, always.

Scrims are a light ink wash (light) or heavier black (dark). Never blur the backdrop.

---

## Shapes

| Token | Value | Use |
|---|---|---|
| `xs` | 3px | Chips, badges |
| `sm` | 4px | Row hover, icon buttons, tree rows, roadmap bars, segmented thumb |
| `md` | 6px | Buttons, inputs, cards, menus |
| `lg` | 8px | Modals, command palette. **Ceiling.** |
| `full` | 9999px | Avatars and 4px progress-bar caps only |

**Nothing exceeds 8px.** Not cards, panels, images, or modals. The 12/16/24px radii common in generated UI are unavailable.

No pill buttons. No pill tabs. Icons are 16px stroke at 1.5px weight from one set, `ink-subtle` at rest and `ink` when active — never chromatic, never filled. **Emoji are not interface icons**; they may appear only inside user-authored content.

---

## Key components

**Buttons.** One `button-primary` per screen, near-black fill. `button-ghost` should outnumber bordered buttons roughly 3:1 — rows of outlined buttons are the exact pattern this system exists to avoid. `button-danger` is a normal secondary button; the confirmation copy carries the weight, not a red fill.

**`InlineField`.** The dominant editing pattern. Detail fields are plain text at rest with no input chrome. Hover reveals a `surface-2` background at 4px radius. Click edits. Blur or `Enter` saves. The `inferred` state — AI-populated, unconfirmed — renders in `ink-muted` with a 1px dashed `hairline-focus` underline that disappears on any interaction. This is the system's one decorative border and it carries real meaning.

**`ObjectRow`.** 36px, transparent, 1px hairline bottom rule. Checkbox, title in `body`, spacer, metadata in `caption` `ink-subtle`, hover-revealed icon buttons. Done state is `ink-faint` with a strikethrough and no background change.

**`Board`.** Columns are transparent with no border and no card — a `micro` header with a count, 8px gaps, nothing else. Cards are canvas with a 1px hairline at 6px radius. This is one of the few places a bordered container is correct, because a card genuinely is a discrete movable object.

**`ProgressBar`.** 4px, `surface-3` track, `ink` fill. The fill is never tinted by status. Trajectory is a separate `micro` word beside it.

**`Gantt`.** 20px bars at 4px radius, `surface-3` track with `ink` fill. Milestones are 8px `ink` squares rotated 45°, filled when reached and 1px outlined when open. Load shading uses four steps of the surface ladder — not a red-to-green gradient.

**`DataTable`.** 36px rows, 1px hairline bottom rules, `micro` `ink-subtle` headers in sentence case. No vertical rules, no zebra striping, no outer border. Numbers right-aligned in tabular figures.

**`Editor`.** Canvas, `read-body` at 680px measure, 32px padding, no border, no card. The AI reflection panel below is collapsed by default, separated by a 1px divider with 24px clearance, and set in `body-sm` — the size shift signals system output rather than your writing.

---

## Motion

| Interaction | Duration | Easing |
|---|---|---|
| Hover, focus, inline state | 120ms | `ease` |
| Pressed | 90ms | `ease` |
| Row completion | 320ms | `ease` |
| Context pane open/close | 220ms | `ease-pane` |
| Modal enter | 180ms | `ease`, 4px rise + fade |
| Menu enter | 120ms | `ease`, 2px rise + fade |
| Toast | 180ms | `ease` |
| Progress fill | 400ms | `ease` |
| Drag lift | 120ms | `ease` |

`prefers-reduced-motion: reduce` drops all transforms and sets durations to 0, keeping opacity fades at 80ms.

No page-load entrances, no scroll reveals, no parallax, no ambient loops.

---

## Themes

Light and dark are equal. Neither is derived from the other; both are authored.

Dark-specific notes:

- Canvas is #0e0e0e, not pure black. Pure black causes halation against light text and flattens the surface ladder.
- The primary button inverts to near-white with near-black text. It stays the highest-contrast object on screen.
- The focus ring becomes `ink` (#ededed) — still the most visible element.
- Overlays gain a 1px `hairline-strong` border, since shadows read weakly on dark.
- `data:` values lighten roughly 15% via the `dark-` variants.

Default to `prefers-color-scheme` with a manual override in settings, persisted to `user_settings.ui.theme`. Apply via `data-theme` on `<html>` before first paint to avoid a flash.

---

## Responsive

| Breakpoint | Width | Changes |
|---|---|---|
| Wide | ≥1440px | Three panes. Sidebar 240, context 360. |
| Standard | 1200px | Three panes. Context 320. |
| Compact | 1024px | Sidebar → 56px rail. Context docked 320. |
| Tablet | 768px | Single pane. Context → right drawer with scrim. |
| Phone | <768px | Single pane. Bottom tabs 52px. Context → route. |

**Type does not scale down.** 14px body stays 14px everywhere. What changes is pane count, column count, and table columns.

Below 1024px: touch targets grow to 44px minimum, rows to 44px, icon buttons to 36px, hover-revealed actions become always-visible, and density locks to comfortable.

---

## Accessibility

- `ink` on `canvas` is 17.4:1. `ink-muted` 7.0:1. `ink-subtle` 4.6:1. `ink-faint` is decorative only.
- The focus ring is 2px `ink` at 2px offset, always visible, never suppressed. Removing accent color makes focus *more* legible, not less.
- Color never carries meaning alone. Trajectory pairs its color with a word. Chart series pair theirs with a label. Since the interface is greyscale, this only ever applies inside charts.
- 24px minimum target on pointer, 44px on touch.
- Hover-revealed actions have keyboard equivalents and are always exposed to assistive technology.

---

## Do's and Don'ts

### Do

- Keep the interface greyscale. If a screen looks plain, that is correct.
- Make the primary button near-black. One per screen.
- Reach for `ghost` before `secondary`.
- Use a 2px ink focus ring at 2px offset.
- Separate sections with a heading, space, and a hairline rule.
- Move one step at a time on the surface ladder.
- Keep Montserrat at 16px and above; everything smaller is Outfit.
- Keep body at 14px and rows at 36px.
- Set every number in tabular figures.
- Use `InlineField` for detail. Fields look like text until touched.
- Reserve the dashed underline for AI-inferred, unconfirmed values.
- Put color only in charts and trajectory indicators.
- Cap radius at 8px.
- Add new values to `tokens.css` first, then map, then use.

### Don't

- **Don't introduce an accent color.** Not blue, not green, not anything. Interaction states are surface steps and ink.
- **Don't use purple, violet, lavender, indigo, or magenta** — including as a grey tint.
- **Don't color a button, link, badge, icon, border, or focus ring.**
- **Don't use `data:` colors outside a chart or a trajectory indicator.**
- **Don't wrap sections in cards.** The bordered-rounded-padded container around a group of settings is the most recognizable generated-UI tell there is.
- **Don't use shadows for in-page hierarchy.** Only overlays float.
- **Don't exceed 8px radius.** Anywhere.
- **Don't build pill buttons or pill tabs.**
- **Don't use gradients** — not on backgrounds, buttons, text, borders, charts, or skeletons.
- **Don't use glassmorphism, backdrop-blur, or translucent panels.**
- **Don't use emoji as interface icons.**
- **Don't set Montserrat below 16px.**
- **Don't set body at 16px** or rows at 48px. That's a landing page pretending to be an app.
- **Don't uppercase micro labels.**
- **Don't hardcode a hex, a radius, a duration, or a font size in a component.**
- **Don't use `dark:` variants in component code.** Themes swap at the token layer.
- **Don't use arbitrary Tailwind values** (`p-[13px]`, `rounded-[12px]`).
- **Don't tint progress bars by status.** The bar is ink; the status is a word beside it.
- **Don't make error states red.** A hairline-focus border and a plain message.
- **Don't animate decoratively.**

---

## Agent prompt guide

### Quick reference

```
Interface color    NONE. Greyscale only.
Primary action     #171717 on #ffffff   (dark: #ededed on #0e0e0e)
Focus ring         2px ink, 2px offset
Canvas             #ffffff  /  #0e0e0e
Surfaces           #fafafa → #f4f4f4 → #ebebeb
Hairline           #e6e6e6  (1px, everywhere)
Ink                #171717 → #5c5c5c → #8a8a8a → #b0b0b0
Headings           Montserrat 600/700, 16px and above ONLY
Body / UI          Outfit 400/500, 14px default
Rows               36px comfortable, 30px compact
Radius             6px controls, 8px modals, 3px chips. Never more.
Shadow             Overlays only.
Color allowed      Charts and trajectory indicators. Nothing else.
Purple             None. Anywhere.
Styling            tokens.css only. No hex, no arbitrary values in components.
```

### Prompts

**New view**
> Build this from DESIGN.md. Greyscale only — no accent color anywhere. Montserrat 600/700 for headings at 16px and up, Outfit 400/500 for everything else. Body 14px, rows 36px. Separate sections with a heading, space, and a 1px hairline — do not wrap them in cards. Shadows only on overlays. 6px radius on controls, 8px maximum. Use existing components from `src/components/ui`; if one is missing, build the primitive first. All values come from tokens — no hex, no arbitrary Tailwind values, no `dark:` variants.

**Detail panel**
> Render in the context pane at 360px using `InlineField` for every property — plain text at rest, `surface-2` on hover, editable on click. AI-inferred values use the `inferred` variant (dashed `hairline-focus` underline). Labels `caption` `ink-subtle`, values `body-sm` `ink`. One `Button variant="primary"` at the bottom; everything else `ghost`.

**Data view**
> Use `DataTable` at 36px rows with 1px hairline bottom rules. Headers `micro` `ink-subtle`, sentence case. No vertical rules, no zebra striping, no outer border. Numbers right-aligned, tabular. Progress as a 4px ink bar with trajectory as a separate `micro` word — the word is the only colored element.

**Chart**
> Use `Chart` with `series-1` through `series-n` for data. All chrome greyscale: 1px `hairline` axes, `micro` `ink-subtle` labels, no gridline fills, no gradients, no shadows. Legend is a 6px series dot plus an `ink-muted` label.

**Review**
> Check against DESIGN.md and remove: any accent color, any color outside a chart or trajectory indicator, any radius above 8px, any shadow not on an overlay, any gradient, any card wrapping a content section, any pill control, any emoji icon, any purple tint, any Montserrat below 16px, any 16px body text, any hardcoded hex, any arbitrary Tailwind value, any `dark:` variant.

---

## Known gaps

- Print styles for the annual review are undefined.
- Chart interaction (hover tooltips, brushing) is unspecified beyond "chrome stays greyscale."
- If categories exceed ten, generate additional tones inside the same desaturation band and avoid purple entirely.
- Montserrat and Outfit are both geometric sans. If the pairing reads as too uniform in practice, the intended fix is widening the weight gap (700 vs. 400), never adding a third family.
