'use client';
import { useEffect, useState } from 'react';
import { BREAKPOINTS, breakpointFor, isAtLeast, type Breakpoint } from '@/lib/breakpoints';

/**
 * matchMedia, not resize listeners. SSR renders `standard` and corrects on
 * hydration, so the shell never flashes the wrong pane count on a wide screen.
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>('standard');

  useEffect(() => {
    const queries = (Object.entries(BREAKPOINTS) as [Breakpoint, number][])
      .filter(([, w]) => w > 0)
      .map(([name, w]) => ({ name, mql: window.matchMedia(`(min-width: ${w}px)`) }));

    const resolve = () => setBp(breakpointFor(window.innerWidth));
    resolve();
    for (const q of queries) q.mql.addEventListener('change', resolve);
    return () => {
      for (const q of queries) q.mql.removeEventListener('change', resolve);
    };
  }, []);

  return bp;
}

export function useIsAtLeast(target: Breakpoint): boolean {
  return isAtLeast(useBreakpoint(), target);
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const set = () => setReduced(mql.matches);
    set();
    mql.addEventListener('change', set);
    return () => mql.removeEventListener('change', set);
  }, []);
  return reduced;
}
