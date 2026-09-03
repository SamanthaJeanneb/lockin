'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UNDO_WINDOW_MS } from '@/lib/constants';
import { uid } from '@/lib/utils';
import { Button } from './Button';

export interface Toast {
  id: string;
  message: string;
  undo?: () => void | Promise<void>;
  duration?: number;
}

interface ToastApi {
  show: (message: string, undo?: () => void | Promise<void>) => void;
  undoLast: () => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

/** Bottom-left, five seconds, one undo action. Undo replaces confirm everywhere
 *  except permanent deletion. ⌘Z fires the most recent one. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const undoStack = useRef<(() => void | Promise<void>)[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback<ToastApi['show']>(
    (message, undo) => {
      const toast: Toast = { id: uid(), message, undo };
      if (undo) undoStack.current.push(undo);
      setToasts((t) => [...t.slice(-3), toast]);
      setTimeout(() => {
        dismiss(toast.id);
        if (undo) undoStack.current = undoStack.current.filter((u) => u !== undo);
      }, toast.duration ?? UNDO_WINDOW_MS);
    },
    [dismiss],
  );

  const undoLast = useCallback(() => {
    const fn = undoStack.current.pop();
    if (!fn) return;
    void fn();
    setToasts((t) => t.slice(0, -1));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && undoStack.current.length) {
        e.preventDefault();
        undoLast();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undoLast]);

  const api = useMemo(() => ({ show, undoLast }), [show, undoLast]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-lg left-lg z-[60] flex flex-col gap-sm"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="anim-toast t-body-sm pointer-events-auto flex items-center gap-md rounded-md bg-action px-md py-sm text-on-action shadow-popover"
          >
            <span>{t.message}</span>
            {t.undo ? (
              <Button
                size="sm"
                className="t-button -mr-xs h-auto px-xs py-0 text-on-action underline hover:bg-transparent"
                onClick={() => {
                  void t.undo?.();
                  dismiss(t.id);
                }}
              >
                Undo
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
