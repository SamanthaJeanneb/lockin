'use client';
import { useId } from 'react';
import { cn } from '@/lib/utils';

export interface Series {
  key: string;
  label: string;
  /** 1–10, mapped to the series tokens. The only chromatic values allowed. */
  series: number;
  value: number;
}

/**
 * Chart chrome is greyscale: 1px hairline axes, micro ink-subtle labels, no
 * gridline fills, no gradients, no shadows. Only the data carries colour, and
 * every colour is paired with a label.
 */
export function BarChart({
  data,
  max,
  formatValue = (v) => String(Math.round(v)),
  onSelect,
  className,
  showLegendDot = true,
}: {
  data: Series[];
  max?: number;
  formatValue?: (v: number) => string;
  onSelect?: (key: string) => void;
  className?: string;
  showLegendDot?: boolean;
}) {
  const ceiling = max ?? Math.max(1, ...data.map((d) => d.value));

  return (
    <div className={cn('flex flex-col', className)} role="img" aria-label="Bar chart">
      {data.map((d) => (
        <button
          key={d.key}
          onClick={() => onSelect?.(d.key)}
          className="flex h-row items-center gap-sm rounded-sm px-xs text-left hover:bg-surface-1"
        >
          {showLegendDot ? (
            <span
              aria-hidden
              className="size-[6px] shrink-0 rounded-full"
              style={{ background: `var(--series-${d.series})` }}
            />
          ) : null}
          <span className="t-body-sm w-gutter shrink-0 truncate">{d.label}</span>
          <span className="h-[8px] flex-1 overflow-hidden rounded-sm bg-surface-2">
            <span
              className="block h-full rounded-sm transition-[width] duration-[400ms]"
              style={{
                width: `${(d.value / ceiling) * 100}%`,
                background: `var(--series-${d.series})`,
              }}
            />
          </span>
          <span className="t-numeric w-[56px] shrink-0 text-right tabular">
            {formatValue(d.value)}
          </span>
        </button>
      ))}
    </div>
  );
}

export function LineChart({
  points,
  height = 120,
  formatValue = (v) => String(Math.round(v)),
  label,
  className,
}: {
  points: { at: string; value: number }[];
  height?: number;
  formatValue?: (v: number) => string;
  label: string;
  className?: string;
}) {
  const id = useId();
  if (points.length < 2) {
    return <div className={cn('h-[120px]', className)} aria-hidden />;
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 600;
  const step = width / (points.length - 1);
  const y = (v: number) => height - ((v - min) / span) * (height - 16) - 8;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${i * step},${y(p.value)}`).join(' ');

  return (
    <figure className={cn('flex flex-col gap-xs', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`${label}: ${formatValue(values[0]!)} to ${formatValue(values[values.length - 1]!)}`}
      >
        <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="var(--hairline)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path
          id={id}
          d={path}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between">
        <span className="t-micro text-ink-subtle">{formatValue(min)}</span>
        <span className="t-micro text-ink-subtle">{formatValue(max)}</span>
      </div>
    </figure>
  );
}

/** Year view of the timeline: one row per area, twelve columns, shaded by
 *  activity using the surface ladder rather than a colour ramp. */
export function HeatStrip({
  rows,
  months,
  onSelect,
}: {
  rows: { area: string; counts: Record<string, number> }[];
  months: string[];
  onSelect?: (area: string, month: string) => void;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => Object.values(r.counts)));
  return (
    <div className="flex flex-col gap-xxs">
      <div className="flex gap-xxs pl-gutter">
        {months.map((m) => (
          <span key={m} className="t-micro flex-1 text-center text-ink-subtle">
            {m.slice(5)}
          </span>
        ))}
      </div>
      {rows.map((r) => (
        <div key={r.area} className="flex items-center gap-xxs">
          <span className="t-body-sm w-gutter shrink-0 truncate">{r.area}</span>
          {months.map((m) => {
            const n = r.counts[m] ?? 0;
            const step = n === 0 ? 0 : n / max > 0.66 ? 3 : n / max > 0.33 ? 2 : 1;
            return (
              <button
                key={m}
                onClick={() => onSelect?.(r.area, m)}
                aria-label={`${r.area}, ${m}: ${n} completions`}
                className={cn(
                  'h-[18px] flex-1 rounded-[1px]',
                  step === 0 && 'bg-surface-1',
                  step === 1 && 'bg-surface-2',
                  step === 2 && 'bg-surface-3',
                  step === 3 && 'bg-hairline-strong',
                )}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
