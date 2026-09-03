'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/store';
import { Icon } from '@/components/ui';

const TABS = [
  { href: '/', label: 'Home', icon: 'House' },
  { href: '/goals/tree', label: 'Goals', icon: 'Target' },
  { href: '/work/board', label: 'Work', icon: 'FolderKanban' },
  { href: '/brain', label: 'Brain', icon: 'BookOpen' },
  { href: '/more', label: 'More', icon: 'Menu' },
];

export function BottomTabs() {
  const pathname = usePathname();
  const openModal = useApp((s) => s.openModal);

  return (
    <>
      <button
        onClick={() => openModal('capture')}
        aria-label="Capture"
        className="fixed bottom-[calc(var(--bottom-tabs-h)+var(--space-lg))] right-lg z-30 flex size-control-lg items-center justify-center rounded-md bg-action text-on-action shadow-popover"
      >
        <Plus size={18} strokeWidth={1.5} />
      </button>

      <nav
        aria-label="Primary"
        className="flex h-bottomtabs shrink-0 items-stretch border-t border-hairline bg-canvas"
      >
        {TABS.map((t) => {
          const root = t.href === '/' ? '/' : `/${t.href.split('/')[1]}`;
          const active = t.href === '/' ? pathname === '/' : pathname.startsWith(root);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                't-micro flex flex-1 flex-col items-center justify-center gap-xxs no-underline',
                active ? 'text-ink' : 'text-ink-subtle',
              )}
            >
              <Icon name={t.icon} />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
