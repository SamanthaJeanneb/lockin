'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { isTypingTarget } from '@/lib/utils';

const GO_MAP: Record<string, string> = {
  h: '/',
  g: '/goals/tree',
  w: '/work/board',
  b: '/brain',
  p: '/people',
  l: '/library',
  f: '/life',
  m: '/money',
  r: '/review/weekly',
  y: '/memory',
};

/** Global shortcuts: ⌘K, C, D, /, G+letter, ⌘\, Esc, ?. */
export function useKeyboardShortcuts() {
  const router = useRouter();
  const openModal = useApp((s) => s.openModal);
  const closeModal = useApp((s) => s.closeModal);
  const modal = useApp((s) => s.modal);
  const setUi = useApp((s) => s.setUi);
  const openContext = useApp((s) => s.openContext);
  // A timestamp, not a boolean with a timer: a stale timeout from an earlier
  // `G` would otherwise clear a prefix the user has only just pressed.
  const goPendingAt = useRef(0);
  const GO_WINDOW_MS = 1500;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openModal('palette');
        return;
      }
      if (mod && e.key === '\\') {
        e.preventDefault();
        setUi({ sidebar_collapsed: !useApp.getState().ui.sidebar_collapsed });
        return;
      }
      if (e.key === 'Escape') {
        if (modal) closeModal();
        else openContext(null);
        return;
      }

      if (isTypingTarget(e.target) || mod || e.altKey) return;

      if (Date.now() - goPendingAt.current < GO_WINDOW_MS) {
        goPendingAt.current = 0;
        const dest = GO_MAP[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          router.push(dest);
          return;
        }
        // Not a destination — fall through so the key still does its own job.
      }

      switch (e.key.toLowerCase()) {
        case 'g':
          goPendingAt.current = Date.now();
          break;
        case 'c':
          e.preventDefault();
          openModal('capture');
          break;
        case 'd':
          e.preventDefault();
          openModal('debrief');
          break;
        case '/':
          e.preventDefault();
          openModal('palette');
          break;
        case '?':
          e.preventDefault();
          openModal('shortcuts');
          break;
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, openModal, closeModal, modal, setUi, openContext]);
}

/** List-level navigation: J/K, Enter, X, E, S, T, 1–4. */
export function useListShortcuts(handlers: {
  onMove?: (delta: number) => void;
  onOpen?: () => void;
  onToggleSelect?: () => void;
  onComplete?: () => void;
  onSnooze?: () => void;
  onToday?: () => void;
  onPriority?: (n: number) => void;
  enabled?: boolean;
}) {
  useEffect(() => {
    if (handlers.enabled === false) return;
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'j' || e.key === 'ArrowDown') return void (e.preventDefault(), handlers.onMove?.(1));
      if (k === 'k' || e.key === 'ArrowUp') return void (e.preventDefault(), handlers.onMove?.(-1));
      if (e.key === 'Enter') return void (e.preventDefault(), handlers.onOpen?.());
      if (k === 'x') return void (e.preventDefault(), handlers.onToggleSelect?.());
      if (k === 'e') return void (e.preventDefault(), handlers.onComplete?.());
      if (k === 's') return void (e.preventDefault(), handlers.onSnooze?.());
      if (k === 't') return void (e.preventDefault(), handlers.onToday?.());
      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        handlers.onPriority?.(Number(e.key));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);
}
