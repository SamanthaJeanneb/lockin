'use client';
import { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { clamp } from '@/lib/utils';
import { useApp } from '@/lib/store';
import { useContextPane } from '@/hooks/useContextPane';
import { Drawer, IconButton } from '@/components/ui';
import { ObjectDetail } from '@/components/composite/ObjectDetail';

const MIN = 320;
const MAX = 520;

/**
 * Three presentation modes, one API. Views call `open(id)`; this decides whether
 * that is a docked grid column, an overlay drawer, or a route push.
 */
export function ContextPane({ children }: { children?: React.ReactNode }) {
  const { mode, objectId, close } = useContextPane();
  const width = useApp((s) => s.ui.context_pane_width);
  const setUi = useApp((s) => s.setUi);
  const dragging = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragging.current) return;
      setUi({ context_pane_width: clamp(window.innerWidth - e.clientX, MIN, MAX) });
    }
    function onUp() {
      dragging.current = false;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [setUi]);

  const body = children ?? (objectId ? <ObjectDetail id={objectId} onClose={close} /> : null);

  if (mode === 'drawer') {
    return (
      <Drawer open={Boolean(objectId)} onOpenChange={(o) => !o && close()} title="Detail">
        {body}
      </Drawer>
    );
  }

  if (mode === 'route' || !objectId) return null;

  return (
    <aside
      aria-label="Detail"
      className="relative flex h-full min-h-0 flex-col border-l border-hairline bg-canvas"
      style={{ width }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize detail pane"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setUi({ context_pane_width: clamp(width + 16, MIN, MAX) });
          if (e.key === 'ArrowRight') setUi({ context_pane_width: clamp(width - 16, MIN, MAX) });
        }}
        className="absolute left-0 top-0 z-10 h-full w-[5px] -translate-x-1/2 cursor-col-resize"
      />
      <div className="absolute right-md top-md z-10">
        <IconButton label="Close detail" onClick={close}>
          <X size={16} strokeWidth={1.5} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
    </aside>
  );
}
