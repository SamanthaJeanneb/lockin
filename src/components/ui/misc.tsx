'use client';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';

/** 16px stroke at 1.5px weight from one set. Never chromatic, never filled. */
export function Icon({
  name,
  size = 16,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Cmp =
    (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>>)[
      name
    ] ?? LucideIcons.Circle;
  return <Cmp size={size} strokeWidth={1.5} className={cn('shrink-0', className)} />;
}

/** The only full-radius element in the system. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        't-micro inline-flex size-avatar shrink-0 items-center justify-center rounded-full',
        'bg-surface-2 text-ink-muted',
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="t-mono inline-flex h-[18px] items-center rounded-xs border border-hairline bg-surface-1 px-xs text-ink-subtle">
      {children}
    </kbd>
  );
}

export function Divider({ className, clearance = 'md' }: { className?: string; clearance?: 'none' | 'sm' | 'md' | 'lg' }) {
  const space = { none: '', sm: 'my-sm', md: 'my-lg', lg: 'my-xl' }[clearance];
  return <hr className={cn('h-px border-0 bg-hairline', space, className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

/** One line and one ghost button. No illustration. */
export function EmptyState({
  message,
  action,
  className,
}: {
  message: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-start gap-md py-xl', className)}>
      <p className="t-body text-ink-subtle">{message}</p>
      {action}
    </div>
  );
}

/** Replaces cards. A heading, optional actions, and a hairline rule. */
export function SectionHeader({
  title,
  count,
  actions,
  className,
  as = 'h2',
  size = 'heading',
}: {
  title: string;
  count?: number | string;
  actions?: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  size?: 'heading' | 'heading-sm' | 'micro';
}) {
  const Tag = as;
  return (
    <div className={cn('flex items-center justify-between gap-md pb-sm', className)}>
      <div className="flex min-w-0 items-baseline gap-sm">
        <Tag className={cn(size === 'micro' ? 't-micro text-ink-subtle' : `t-${size}`, 'truncate')}>
          {title}
        </Tag>
        {count != null ? <span className="t-micro shrink-0 text-ink-faint tabular">{count}</span> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-xs">{actions}</div> : null}
    </div>
  );
}

export function Meta({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('t-caption text-ink-subtle', className)}>{children}</span>;
}
