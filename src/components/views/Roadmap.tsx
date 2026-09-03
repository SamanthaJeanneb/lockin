'use client';
import { useMemo, useRef, useState } from 'react';
import { DndContext, PointerSensor, KeyboardSensor, TouchSensor, useDraggable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatShortDate } from '@/lib/format';
import { useContextPane } from '@/hooks/useContextPane';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { EmptyState, ProgressBar, Segmented, Tooltip } from '@/components/ui';

export interface RoadmapData {
  from: string;
  to: string;
  zoom: string;
  buckets: string[];
  bars: {
    id: string; title: string; area: string | null; start: string; end: string;
    progress: number; openTasks: number; weeklyHours: number;
    milestones: { id: string; title: string; at: string; reached: boolean }[];
  }[];
  load: { start: string; committedHours: number; availableHours: number; ratio: number }[];
}

const ZOOMS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'five', label: '5 years' },
] as const;

const LABEL_W = 140;

/**
 * Bars are projects, diamonds are milestones. Dragging a bar shifts everything
 * inside it proportionally. Load shading uses four steps of the surface ladder —
 * never a red-to-green gradient.
 */
export function Roadmap({
  data,
  zoom,
  onZoom,
  onReschedule,
}: {
  data: RoadmapData | undefined;
  zoom: string;
  onZoom: (z: string) => void;
  onReschedule: (id: string, deltaDays: number) => void;
}) {
  const bp = useBreakpoint();
  const { open } = useContextPane();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const span = useMemo(() => {
    if (!data) return { from: 0, to: 1, ms: 1 };
    const from = new Date(data.from).getTime();
    const to = new Date(data.to).getTime();
    return { from, to, ms: Math.max(1, to - from) };
  }, [data]);

  const columns = data?.buckets.length ?? 12;
  const columnWidth = Math.max(72, width / columns);
  const trackWidth = columnWidth * columns;

  function pct(iso: string) {
    return ((new Date(iso).getTime() - span.from) / span.ms) * 100;
  }

  function onDragEnd(e: DragEndEvent) {
    const dx = e.delta.x;
    if (!dx || !data) return;
    const daysPerPx = span.ms / 86_400_000 / trackWidth;
    onReschedule(String(e.active.id), Math.round(dx * daysPerPx));
  }

  // On a phone the roadmap becomes a vertical list grouped by month. Same
  // information, no bars.
  if (bp === 'phone') {
    return (
      <div className="flex flex-col gap-lg">
        <Segmented options={[...ZOOMS]} value={zoom as never} onChange={onZoom} size="sm" />
        {!data?.bars.length ? <EmptyState message="No projects scheduled yet." /> : null}
        {groupByMonth(data?.bars ?? []).map(([month, bars]) => (
          <section key={month}>
            <h3 className="t-micro mb-xs text-ink-subtle">{month}</h3>
            {bars.map((b) => (
              <button
                key={b.id}
                onClick={() => open(b.id)}
                className="flex w-full flex-col gap-xs border-b border-hairline py-sm text-left"
              >
                <span className="t-body-sm">{b.title}</span>
                <span className="t-caption text-ink-subtle">
                  {formatShortDate(b.start)} – {formatShortDate(b.end)} · {Math.round(b.progress)}%
                </span>
                <ProgressBar value={b.progress} />
              </button>
            ))}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-center justify-between gap-md">
        <Segmented options={[...ZOOMS]} value={zoom as never} onChange={onZoom} size="sm" />
        {data ? (
          <span className="t-caption text-ink-subtle">
            {format(new Date(data.from), 'MMM yyyy')} – {format(new Date(data.to), 'MMM yyyy')}
          </span>
        ) : null}
      </div>

      <div
        ref={(el) => {
          scrollRef.current = el;
          if (el && el.clientWidth - LABEL_W !== width) setWidth(el.clientWidth - LABEL_W);
        }}
        className="overflow-x-auto"
      >
        <div style={{ width: LABEL_W + trackWidth }}>
          {/* Column headers */}
          <div className="flex">
            <div className="shrink-0 bg-canvas" style={{ width: LABEL_W }} />
            {(data?.buckets ?? []).map((b) => (
              <div
                key={b}
                className="t-micro shrink-0 text-ink-subtle"
                style={{ width: columnWidth }}
              >
                {format(new Date(b), zoom === 'week' ? 'EEE d' : zoom === 'five' ? 'QQQ yy' : 'MMM')}
              </div>
            ))}
          </div>

          {/* Load strip — four steps of the surface ladder */}
          <div className="flex items-center border-b border-hairline pb-xs">
            <div className="t-micro shrink-0 text-ink-subtle" style={{ width: LABEL_W }}>
              load
            </div>
            {(data?.load ?? []).map((l) => (
              <div key={l.start} className="shrink-0 px-px" style={{ width: columnWidth }}>
                <Tooltip
                  content={`${l.committedHours}h committed of ${l.availableHours}h available`}
                >
                  <div className="flex gap-px">
                    {[0.25, 0.5, 0.75, 1].map((step) => (
                      <span
                        key={step}
                        className={cn(
                          'h-[8px] flex-1 rounded-[1px]',
                          l.ratio >= step ? 'bg-surface-3' : 'bg-surface-1',
                          l.ratio >= step && step > 0.5 ? 'bg-hairline-strong' : '',
                        )}
                      />
                    ))}
                  </div>
                </Tooltip>
              </div>
            ))}
          </div>

          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="flex flex-col">
              {(data?.bars ?? []).map((b) => (
                <div key={b.id} className="group/row flex h-row items-center hover:bg-surface-1">
                  <button
                    onClick={() => open(b.id)}
                    className="t-body-sm shrink-0 truncate pr-sm text-left"
                    style={{ width: LABEL_W }}
                    title={b.title}
                  >
                    {b.title}
                  </button>

                  <div className="relative h-full flex-1" style={{ width: trackWidth }}>
                    <Bar
                      id={b.id}
                      left={pct(b.start)}
                      width={Math.max(1.5, pct(b.end) - pct(b.start))}
                      progress={b.progress}
                      title={b.title}
                      hours={b.weeklyHours}
                      onOpen={() => open(b.id)}
                    />
                    {b.milestones.map((m) => (
                      <Tooltip key={m.id} content={`${m.title} · ${formatShortDate(m.at)}`}>
                        <span
                          className={cn(
                            'absolute top-1/2 size-[8px] -translate-x-1/2 -translate-y-1/2 rotate-45',
                            m.reached ? 'bg-ink' : 'border border-ink bg-canvas',
                          )}
                          style={{ left: `${pct(m.at)}%` }}
                        />
                      </Tooltip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DndContext>

          {!data?.bars.length ? (
            <EmptyState message="No projects with dates yet. Give a project a start and a due date and it appears here." />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Bar({
  id, left, width, progress, title, hours, onOpen,
}: {
  id: string;
  left: number;
  width: number;
  progress: number;
  title: string;
  hours: number;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  return (
    <Tooltip content={`${title} · ${Math.round(progress)}%${hours ? ` · ${hours}h/wk` : ''}`}>
      <div
        ref={setNodeRef}
        onClick={onOpen}
        className={cn(
          'absolute top-1/2 h-[20px] -translate-y-1/2 cursor-grab overflow-hidden rounded-sm bg-surface-3',
          isDragging && 'cursor-grabbing shadow-drag',
        )}
        style={{
          left: `${left}%`,
          width: `${width}%`,
          transform: transform ? `translate3d(${transform.x}px, -50%, 0)` : undefined,
        }}
        {...attributes}
        {...listeners}
      >
        <span
          className="absolute inset-y-0 left-0 bg-ink"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
    </Tooltip>
  );
}

function groupByMonth(bars: RoadmapData['bars']) {
  const map = new Map<string, RoadmapData['bars']>();
  for (const b of bars) {
    const key = format(new Date(b.start), 'MMMM yyyy');
    (map.get(key) ?? map.set(key, []).get(key)!).push(b);
  }
  return [...map.entries()];
}
