'use client';
import Link from 'next/link';
import { NAV, NAV_SECONDARY } from '@/components/shell/Sidebar';
import { Icon, SectionHeader } from '@/components/ui';

/** The phone tab bar carries five destinations; the rest live here. */
export default function MorePage() {
  return (
    <div className="flex min-h-full flex-col p-xl">
      <h1 className="t-display mb-lg">More</h1>
      <SectionHeader title="Everywhere else" size="micro" as="h2" />
      <div className="flex flex-col">
        {[...NAV.slice(3), ...NAV_SECONDARY, { href: '/settings', label: 'Settings', icon: 'Settings', go: '' }].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex h-row items-center gap-sm border-b border-hairline px-xs no-underline"
          >
            <span className="text-ink-subtle">
              <Icon name={item.icon} />
            </span>
            <span className="t-body">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
