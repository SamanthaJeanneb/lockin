'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays } from 'date-fns';
import { api } from '@/lib/client-api';
import { Roadmap, type RoadmapData } from '@/components/views/Roadmap';
import { Skeleton, useToast } from '@/components/ui';

export default function RoadmapPage() {
  const [zoom, setZoom] = useState('year');
  const qc = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['roadmap', zoom],
    queryFn: () => api.get<RoadmapData>(`/api/roadmap?zoom=${zoom}`),
  });

  /** Dragging a bar shifts the project and everything inside it proportionally. */
  const reschedule = useMutation({
    mutationFn: async ({ id, deltaDays }: { id: string; deltaDays: number }) => {
      const bar = data?.bars.find((b) => b.id === id);
      if (!bar) return;
      await api.patch(`/api/objects/${id}`, {
        startAt: addDays(new Date(bar.start), deltaDays).toISOString(),
        dueAt: addDays(new Date(bar.end), deltaDays).toISOString(),
      });
      for (const m of bar.milestones) {
        await api.patch(`/api/objects/${m.id}`, {
          dueAt: addDays(new Date(m.at), deltaDays).toISOString(),
        });
      }
      return { id, deltaDays, bar };
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['roadmap'] });
      if (!result) return;
      toast.show(
        `Moved ${result.bar.title} ${result.deltaDays > 0 ? 'later' : 'earlier'}`,
        async () => {
          await api.patch(`/api/objects/${result.id}`, {
            startAt: result.bar.start,
            dueAt: result.bar.end,
          });
          for (const m of result.bar.milestones) {
            await api.patch(`/api/objects/${m.id}`, { dueAt: m.at });
          }
          void qc.invalidateQueries({ queryKey: ['roadmap'] });
        },
      );
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-xs">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-row w-full" />
        ))}
      </div>
    );
  }

  return (
    <Roadmap
      data={data}
      zoom={zoom}
      onZoom={setZoom}
      onReschedule={(id, deltaDays) => deltaDays && reschedule.mutate({ id, deltaDays })}
    />
  );
}
