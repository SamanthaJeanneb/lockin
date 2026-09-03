'use client';
import { useCallback, useRef } from 'react';
import { useApp } from '@/lib/store';

/** Shift-click ranges and ⌘-click additions over an ordered id list. */
export function useSelection(orderedIds: string[]) {
  const selection = useApp((s) => s.selection);
  const setSelection = useApp((s) => s.setSelection);
  const clear = useApp((s) => s.clearSelection);
  const anchor = useRef<string | null>(null);

  const onSelect = useCallback(
    (id: string, e?: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }) => {
      if (e?.shiftKey && anchor.current) {
        const a = orderedIds.indexOf(anchor.current);
        const b = orderedIds.indexOf(id);
        if (a !== -1 && b !== -1) {
          const [from, to] = a < b ? [a, b] : [b, a];
          setSelection(orderedIds.slice(from, to + 1));
          return;
        }
      }
      if (e?.metaKey || e?.ctrlKey) {
        anchor.current = id;
        setSelection(
          selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id],
        );
        return;
      }
      anchor.current = id;
      setSelection(selection.length === 1 && selection[0] === id ? [] : [id]);
    },
    [orderedIds, selection, setSelection],
  );

  return { selection, onSelect, clear, isSelected: (id: string) => selection.includes(id) };
}
