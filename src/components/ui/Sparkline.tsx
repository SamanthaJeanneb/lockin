'use client';
import { useId } from 'react';

/** 1px ink stroke. No fill, no gradient, no shadow. */
export function Sparkline({
  values,
  width = 96,
  height = 24,
  className,
  stroke,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Only a chart may pass a series token here. */
  stroke?: string;
}) {
  const id = useId();
  if (values.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - min) / span) * (height - 2) - 1).toFixed(2)}`)
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`Trend from ${Math.round(values[0]!)} to ${Math.round(values[values.length - 1]!)}`}
    >
      <polyline
        id={id}
        points={points}
        fill="none"
        stroke={stroke ?? 'var(--ink)'}
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
