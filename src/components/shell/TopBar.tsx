'use client';
import Link from 'next/link';
import { format } from 'date-fns';
import { useMounted } from '@/hooks/useMounted';
import { PanelLeft, RefreshCw, Settings, Sparkle } from 'lucide-react';
import { useApp } from '@/lib/store';
import { IconButton, Kbd } from '@/components/ui';
import { cn } from '@/lib/utils';

export function TopBar({ syncing, compact }: { syncing?: boolean; compact?: boolean }) {
  const openModal = useApp((s) => s.openModal);
  const ui = useApp((s) => s.ui);
  const setUi = useApp((s) => s.setUi);
  const mounted = useMounted();

  return (
    <header className="flex h-topbar shrink-0 items-center gap-md border-b border-hairline bg-canvas px-md">
      {!compact ? (
        <IconButton
          label="Toggle sidebar"
          onClick={() => setUi({ sidebar_collapsed: !ui.sidebar_collapsed })}
        >
          <PanelLeft size={16} strokeWidth={1.5} />
        </IconButton>
      ) : null}

      <Link href="/" className="t-heading-sm shrink-0 no-underline">
        LockIn
      </Link>

      <button
        onClick={() => openModal('palette')}
        className={cn(
          't-body-sm flex h-control-md min-w-0 flex-1 items-center gap-sm rounded-md',
          'border border-hairline-strong bg-canvas px-sm text-ink-faint',
          'transition-colors duration-[120ms] hover:border-hairline-focus',
        )}
      >
        <Kbd>⌘K</Kbd>
        <span className="truncate">Search or capture…</span>
      </button>

      <span className="t-caption hidden shrink-0 text-ink-subtle tablet:block">
        {mounted ? format(new Date(), 'EEE d MMM') : null}
      </span>

      <span
        className="t-caption hidden shrink-0 items-center gap-xs text-ink-subtle compact:flex"
        aria-live="polite"
      >
        <RefreshCw size={12} strokeWidth={1.5} className={syncing ? 'animate-spin' : ''} />
        {syncing ? 'syncing' : 'synced'}
      </span>

      <IconButton label="Ask LockIn" onClick={() => openModal('palette')}>
        <Sparkle size={16} strokeWidth={1.5} />
      </IconButton>

      <Link href="/settings" aria-label="Settings" className="no-underline">
        <IconButton label="Settings">
          <Settings size={16} strokeWidth={1.5} />
        </IconButton>
      </Link>
    </header>
  );
}
