'use client';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { isAtLeast, type Breakpoint } from '@/lib/breakpoints';
import { EmptyState } from '@/components/ui';

export interface Column<T> {
  key: string;
  header: string;
  /** The narrowest breakpoint at which this column still renders. */
  from?: Breakpoint;
  align?: 'left' | 'right';
  width?: string;
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
}

/**
 * 36px rows, 1px hairline bottom rules, micro sentence-case headers. No
 * vertical rules, no zebra striping, no outer border. Numbers right-aligned in
 * tabular figures. Below tablet it becomes stacked cards.
 */
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onOpen,
  selectedId,
  empty = 'Nothing here yet.',
  defaultSort,
  cardTitle,
}: {
  rows: T[];
  columns: Column<T>[];
  onOpen?: (row: T) => void;
  selectedId?: string | null;
  empty?: string;
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  cardTitle?: (row: T) => React.ReactNode;
}) {
  const bp = useBreakpoint();
  const [sort, setSort] = useState(defaultSort ?? null);

  const visible = columns.filter((c) => !c.from || isAtLeast(bp, c.from));

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  if (!rows.length) return <EmptyState message={empty} />;

  if (bp === 'phone') {
    return (
      <div className="flex flex-col">
        {sorted.map((row) => (
          <button
            key={row.id}
            onClick={() => onOpen?.(row)}
            className="flex flex-col gap-xs border-b border-hairline py-sm text-left"
          >
            <span className="t-body">{cardTitle ? cardTitle(row) : visible[0]?.render(row)}</span>
            <div className="flex flex-wrap items-center gap-md">
              {visible.slice(1, 4).map((c) => (
                <span key={c.key} className="t-caption text-ink-subtle">
                  {c.render(row)}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {visible.map((c) => (
            <th
              key={c.key}
              scope="col"
              style={{ width: c.width }}
              className={cn(
                't-micro h-row-compact border-b border-hairline-strong px-xs text-ink-subtle',
                c.align === 'right' ? 'text-right' : 'text-left',
              )}
            >
              {c.sortValue ? (
                <button
                  onClick={() =>
                    setSort((s) =>
                      s?.key === c.key
                        ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
                        : { key: c.key, dir: 'asc' },
                    )
                  }
                  className={cn(
                    'inline-flex items-center gap-xxs',
                    c.align === 'right' && 'flex-row-reverse',
                  )}
                >
                  {c.header}
                  {sort?.key === c.key ? (
                    sort.dir === 'asc' ? (
                      <ChevronUp size={11} strokeWidth={1.5} />
                    ) : (
                      <ChevronDown size={11} strokeWidth={1.5} />
                    )
                  ) : null}
                </button>
              ) : (
                c.header
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr
            key={row.id}
            onClick={() => onOpen?.(row)}
            className={cn(
              'h-row cursor-default border-b border-hairline transition-colors duration-[120ms]',
              selectedId === row.id ? 'bg-surface-2' : 'hover:bg-surface-1',
            )}
          >
            {visible.map((c) => (
              <td
                key={c.key}
                className={cn(
                  't-body-sm px-xs',
                  c.align === 'right' ? 'text-right tabular' : 'text-left',
                )}
              >
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
