'use client';
import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { isAtLeast } from '@/lib/breakpoints';
import { useApp } from '@/lib/store';
import type { UiState } from '@/lib/db/schema';
import { api, type TodayItem } from '@/lib/client-api';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomTabs } from './BottomTabs';
import { ContextPane } from './ContextPane';
import { CommandPalette } from '@/components/composite/CommandPalette';
import { CaptureModal } from '@/components/capture/CaptureModal';
import { DebriefModal } from '@/components/debrief/DebriefModal';
import { ShortcutSheet } from './ShortcutSheet';
import { GlobalDropZone } from './GlobalDropZone';

/**
 * The only component that knows about panes.
 *
 *   < tablet : [ main ]                        bottom tabs, context = route
 *   tablet   : [ rail | main ]                 context = overlay drawer
 *   compact  : [ rail | main | context 320 ]
 *   standard : [ sidebar 240 | main | context 320 ]
 *   wide     : [ sidebar 240 | main | context 360 ]
 */
export function AppShell({
  children,
  initialUi,
}: {
  children: React.ReactNode;
  initialUi: UiState;
}) {
  const bp = useBreakpoint();
  const hydrate = useApp((s) => s.hydrate);
  const ui = useApp((s) => s.ui);
  const openModal = useApp((s) => s.openModal);
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  useKeyboardShortcuts();

  useEffect(() => {
    hydrate(initialUi);
    // A real signal that the client is live and the global key handler is
    // registered. Tests wait on this rather than guessing with a timeout, and
    // it costs one attribute.
    document.documentElement.dataset.hydrated = 'true';
  }, [hydrate, initialUi]);

  useEffect(() => {
    if (ui.theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      document.documentElement.setAttribute('data-theme', mql.matches ? 'dark' : 'light');
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [ui.theme]);

  // Deep links from the PWA shortcuts, the share target and notifications.
  useEffect(() => {
    if (search.get('capture')) openModal('capture', search.get('draft') ?? undefined);
    else if (search.get('debrief')) openModal('debrief');
  }, [search, openModal]);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<{ user: { onboardedAt: string | null } }>('/api/settings'),
    staleTime: 300_000,
  });

  useEffect(() => {
    if (settings && !settings.user.onboardedAt && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
  }, [settings, pathname, router]);

  const { data: today } = useQuery({
    queryKey: ['today'],
    queryFn: () => api.get<{ items: TodayItem[] }>('/api/today'),
    staleTime: 60_000,
  });

  const todayProgress = today
    ? {
        done: today.items.filter((i) => i.object.completedAt).length,
        total: today.items.length,
      }
    : undefined;

  const isPhone = bp === 'phone';
  // Below 1200px the sidebar is always a rail; above it, the user's choice.
  const railed = !isAtLeast(bp, 'standard') || ui.sidebar_collapsed;

  return (
    <div className="shell-grid grid-rows-[auto_1fr]">
      <TopBar compact={isPhone} />

      <div className="grid min-h-0 grid-cols-[auto_1fr_auto]">
        {!isPhone ? <Sidebar collapsed={railed} todayProgress={todayProgress} /> : <div />}

        <main className="min-w-0 overflow-y-auto">{children}</main>

        <ContextPane />
      </div>

      {isPhone ? <BottomTabs /> : null}

      <CommandPalette />
      <CaptureModal />
      <DebriefModal />
      <ShortcutSheet />
      <GlobalDropZone />
    </div>
  );
}
