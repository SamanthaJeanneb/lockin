import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isThisYear,
  isToday,
  isTomorrow,
  isYesterday,
} from 'date-fns';

export function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Today", "Tomorrow", "Tue 8 Sep", "8 Sep 2027". Never a bare ISO string. */
export function formatDue(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return '—';
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  if (isYesterday(d)) return 'Yesterday';
  const days = differenceInCalendarDays(d, new Date());
  if (days > 0 && days < 7) return format(d, 'EEE d MMM');
  return isThisYear(d) ? format(d, 'd MMM') : format(d, 'd MMM yyyy');
}

export function formatTime(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? format(d, 'h:mmaaa').replace(':00', '') : '';
}

export function formatDayHeading(v: string | Date): string {
  const d = toDate(v)!;
  return format(d, 'd MMMM yyyy');
}

export function formatShortDate(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? format(d, 'd MMM') : '—';
}

export function relative(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? formatDistanceToNowStrict(d, { addSuffix: true }) : '—';
}

export function daysSince(v: string | Date | null | undefined): number | null {
  const d = toDate(v);
  return d ? Math.max(0, differenceInCalendarDays(new Date(), d)) : null;
}

export function formatDays(n: number | null): string {
  if (n == null) return '—';
  if (n === 0) return 'today';
  return `${n}d`;
}

export function formatMinutes(m: number | null | undefined): string {
  if (!m) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const moneyCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(n: number | null | undefined, opts?: { cents?: boolean }): string {
  if (n == null || Number.isNaN(n)) return '—';
  return opts?.cents ? moneyCents.format(n) : money.format(n);
}

/** $1.24M / $902K / $412 — for metric tiles where width is scarce. */
export function formatMoneyCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000)}K`;
  return money.format(n);
}

export function formatPercent(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function formatDelta(n: number | null | undefined, unit = ''): string {
  if (n == null || Number.isNaN(n) || Math.abs(n) < 0.5) return `→ 0${unit}`;
  return n > 0 ? `↑ ${Math.round(n)}${unit}` : `↓ ${Math.abs(Math.round(n))}${unit}`;
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function greeting(now = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = now.getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
