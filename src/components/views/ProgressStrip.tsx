'use client';
import type { AreaProgress } from '@/lib/client-api';
import { formatDelta } from '@/lib/format';
import { BlockBar, SectionHeader } from '@/components/ui';

/** The bar is ink. The delta is a plain word beside it — no tinting by status. */
export function ProgressStrip({
  areas,
  onSelect,
}: {
  areas: AreaProgress[];
  onSelect?: (area: string) => void;
}) {
  return (
    <section>
      <SectionHeader title="Progress" size="heading-sm" />
      <div className="flex flex-col">
        {areas.map((a) => (
          <button
            key={a.key}
            onClick={() => onSelect?.(a.key)}
            className="flex h-row items-center gap-md rounded-sm px-xs text-left hover:bg-surface-1"
          >
            <span className="t-body-sm w-[110px] shrink-0 truncate">{a.label}</span>
            <BlockBar value={a.value} />
            <span className="t-numeric w-[42px] shrink-0 text-right tabular">{a.value}%</span>
            <span className="t-caption w-[44px] shrink-0 text-ink-subtle tabular">
              {formatDelta(a.delta)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
