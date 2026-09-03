'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/store';
import { Icon, Kbd, ProgressBar, Tooltip } from '@/components/ui';
import type { AreaProgress } from '@/lib/client-api';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  go: string;
  children?: { href: string; label: string }[];
}

export const NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: 'House', go: 'H' },
  {
    href: '/goals/tree',
    label: 'Goals',
    icon: 'Target',
    go: 'G',
    children: [
      { href: '/goals/tree', label: 'Tree' },
      { href: '/goals/roadmap', label: 'Roadmap' },
      { href: '/goals/drift', label: 'Drift' },
    ],
  },
  {
    href: '/work/board',
    label: 'Work',
    icon: 'FolderKanban',
    go: 'W',
    children: [
      { href: '/work/board', label: 'Board' },
      { href: '/work/projects', label: 'Projects' },
      { href: '/work/backlog', label: 'Backlog' },
      { href: '/work/waiting', label: 'Waiting' },
    ],
  },
  { href: '/brain', label: 'Brain', icon: 'BookOpen', go: 'B' },
  { href: '/people', label: 'People', icon: 'Users', go: 'P' },
  { href: '/library', label: 'Library', icon: 'Library', go: 'L' },
  { href: '/life', label: 'Life', icon: 'Camera', go: 'F' },
  { href: '/money', label: 'Money', icon: 'Wallet', go: 'M' },
];

export const NAV_SECONDARY: NavItem[] = [
  { href: '/memory', label: 'Memory', icon: 'Brain', go: 'Y' },
  { href: '/review/weekly', label: 'Review', icon: 'CalendarCheck', go: 'R' },
];

export function Sidebar({
  collapsed,
  todayProgress,
}: {
  collapsed: boolean;
  todayProgress?: { done: number; total: number };
}) {
  const pathname = usePathname();
  const openModal = useApp((s) => s.openModal);

  const { data: views } = useQuery({
    queryKey: ['saved-views'],
    queryFn: () =>
      api.get<{ views: { id: string; name: string; surface: string; isPinned: boolean }[] }>(
        '/api/views',
      ),
    staleTime: 120_000,
  });
  const pinned = (views?.views ?? []).filter((v) => v.isPinned);

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'flex h-full min-h-0 flex-col border-r border-hairline bg-surface-1',
        collapsed ? 'w-rail' : 'w-sidebar',
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-sm py-md">
        <ul className="flex flex-col gap-xxs">
          {NAV.map((item) => (
            <SidebarItem key={item.href} item={item} collapsed={collapsed} pathname={pathname} />
          ))}
        </ul>

        <div className="my-md h-px bg-hairline" />

        <ul className="flex flex-col gap-xxs">
          {NAV_SECONDARY.map((item) => (
            <SidebarItem key={item.href} item={item} collapsed={collapsed} pathname={pathname} />
          ))}
        </ul>

        {!collapsed && pinned.length ? (
          <>
            <div className="my-md h-px bg-hairline" />
            <p className="t-micro px-sm pb-xs text-ink-subtle">Views</p>
            <ul className="flex flex-col gap-xxs">
              {pinned.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/${v.surface === 'board' ? 'work/board' : v.surface}?view=${v.id}`}
                    className="t-body-sm flex h-control-md items-center rounded-sm px-sm text-ink-muted no-underline transition-colors duration-[120ms] hover:bg-surface-2 hover:text-ink"
                  >
                    <span className="truncate">{v.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div className="border-t border-hairline p-sm">
        {!collapsed && todayProgress ? (
          <div className="mb-sm px-sm">
            <div className="t-micro mb-xs flex items-center justify-between text-ink-subtle">
              <span>Today</span>
              <span className="tabular">
                {todayProgress.done}/{todayProgress.total}
              </span>
            </div>
            <ProgressBar
              value={todayProgress.total ? (todayProgress.done / todayProgress.total) * 100 : 0}
              label="Today's progress"
            />
          </div>
        ) : null}

        <button
          onClick={() => openModal('capture')}
          className={cn(
            't-button flex h-control-md w-full items-center gap-sm rounded-md px-sm',
            'text-ink-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-ink',
            collapsed && 'justify-center px-0',
          )}
        >
          <Plus size={16} strokeWidth={1.5} />
          {!collapsed ? (
            <>
              <span className="flex-1 text-left">Capture</span>
              <Kbd>C</Kbd>
            </>
          ) : null}
        </button>
      </div>
    </nav>
  );
}

function SidebarItem({
  item,
  collapsed,
  pathname,
}: {
  item: NavItem;
  collapsed: boolean;
  pathname: string;
}) {
  const root = item.href === '/' ? '/' : `/${item.href.split('/')[1]}`;
  const active = item.href === '/' ? pathname === '/' : pathname.startsWith(root);

  const link = (
    <Link
      href={item.href}
      prefetch
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-control-md items-center gap-sm rounded-sm px-sm',
        'transition-colors duration-[120ms]',
        active
          ? 't-subheading bg-surface-3 text-ink'
          : 't-body-sm text-ink-muted hover:bg-surface-2 hover:text-ink',
        collapsed && 'justify-center px-0',
      )}
    >
      {active ? (
        <span aria-hidden className="absolute left-0 top-1/2 h-[16px] w-[2px] -translate-y-1/2 bg-ink" />
      ) : null}
      <Icon name={item.icon} />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );

  return (
    <li>
      {collapsed ? (
        <Tooltip side="right" content={`${item.label} · G ${item.go}`}>
          {link}
        </Tooltip>
      ) : (
        link
      )}
      {!collapsed && active && item.children ? (
        <ul className="ml-lg mt-xxs flex flex-col gap-xxs border-l border-hairline pl-sm">
          {item.children.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                prefetch
                className={cn(
                  't-body-sm flex h-[26px] items-center rounded-sm px-sm transition-colors duration-[120ms]',
                  pathname === c.href ? 'text-ink' : 'text-ink-subtle hover:text-ink',
                )}
              >
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
