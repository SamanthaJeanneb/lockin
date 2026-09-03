'use client';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { useBreakpoint } from './useBreakpoint';
import { contextPaneMode } from '@/lib/breakpoints';

/**
 * Views call `open(id)` and never check the viewport. The shell decides whether
 * that means a docked column, an overlay drawer, or a real route push — which is
 * what keeps the phone version from becoming a second codebase.
 */
export function useContextPane() {
  const bp = useBreakpoint();
  const mode = contextPaneMode(bp);
  const router = useRouter();
  const objectId = useApp((s) => s.contextObjectId);
  const setId = useApp((s) => s.openContext);

  const open = useCallback(
    (id: string) => {
      if (mode === 'route') router.push(`/o/${id}`);
      else setId(id);
    },
    [mode, router, setId],
  );

  const close = useCallback(() => setId(null), [setId]);

  return { mode, objectId, open, close, isOpen: objectId !== null };
}
