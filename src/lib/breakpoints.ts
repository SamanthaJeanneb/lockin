/**
 * The five breakpoints. Mirrored exactly in globals.css `@theme` so a
 * class-based decision and a JS decision can never disagree.
 */
export const BREAKPOINTS = {
  phone: 0, //  < 768   single pane, bottom tabs, context = route
  tablet: 768, //  768+   icon rail, context = overlay drawer
  compact: 1024, // 1024+   icon rail, context docked 320
  standard: 1200, // 1200+   sidebar expanded, context docked 320
  wide: 1440, // 1440+   sidebar expanded, context docked 360
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export const BREAKPOINT_ORDER: Breakpoint[] = ['phone', 'tablet', 'compact', 'standard', 'wide'];

export function breakpointFor(width: number): Breakpoint {
  if (width >= BREAKPOINTS.wide) return 'wide';
  if (width >= BREAKPOINTS.standard) return 'standard';
  if (width >= BREAKPOINTS.compact) return 'compact';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'phone';
}

export function isAtLeast(current: Breakpoint, target: Breakpoint): boolean {
  return BREAKPOINT_ORDER.indexOf(current) >= BREAKPOINT_ORDER.indexOf(target);
}

/** How the context pane presents itself at a given width. */
export type ContextPaneMode = 'docked' | 'drawer' | 'route';

export function contextPaneMode(bp: Breakpoint): ContextPaneMode {
  if (isAtLeast(bp, 'compact')) return 'docked';
  if (bp === 'tablet') return 'drawer';
  return 'route';
}

/** Board columns visible before horizontal scroll kicks in. */
export function boardColumnsVisible(bp: Breakpoint): number {
  switch (bp) {
    case 'wide':
      return 6;
    case 'standard':
      return 5;
    case 'compact':
      return 4;
    case 'tablet':
      return 3;
    default:
      return 1;
  }
}

/** Months the roadmap shows at once. */
export function roadmapMonths(bp: Breakpoint): number {
  if (bp === 'wide') return 12;
  if (bp === 'phone') return 0; // vertical list, no bars
  return 6;
}
