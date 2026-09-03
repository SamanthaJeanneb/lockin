import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function groupBy<T, K extends string | number>(items: T[], key: (t: T) => K) {
  const out = {} as Record<K, T[]>;
  for (const item of items) {
    const k = key(item);
    (out[k] ||= []).push(item);
  }
  return out;
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function sum(items: number[]) {
  return items.reduce((a, b) => a + b, 0);
}

export function median(items: number[]) {
  if (!items.length) return 0;
  const s = [...items].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Fractional index between two positions, for drag reordering without a reindex pass. */
export function positionBetween(before: number | null, after: number | null): number {
  if (before == null && after == null) return 0;
  if (before == null) return after! - 1;
  if (after == null) return before + 1;
  return (before + after) / 2;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const wrapped = (...args: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => t && clearTimeout(t);
  return wrapped;
}

export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}
