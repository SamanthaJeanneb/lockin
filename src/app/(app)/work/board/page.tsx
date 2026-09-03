'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type SerializedObject } from '@/lib/client-api';
import { useApp } from '@/lib/store';
import { Board } from '@/components/views/Board';
import { Button, Input, Select, Skeleton, useToast } from '@/components/ui';

/** The lens filters one dataset. Switching lenses never duplicates data — it is
 *  the same set viewed differently. */
export default function BoardPage() {
  const lens = useApp((s) => s.ui.last_board_lens);
  const setUi = useApp((s) => s.setUi);
  const [type, setType] = useState('task');
  const [saving, setSaving] = useState(false);
  const [viewName, setViewName] = useState('');
  const search = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();

  const { data: views } = useQuery({
    queryKey: ['saved-views'],
    queryFn: () =>
      api.get<{ views: { id: string; name: string; filters: Record<string, string> }[] }>(
        '/api/views?surface=board',
      ),
  });

  // Opening a pinned view restores the lens and type it was saved with.
  useEffect(() => {
    const id = search.get('view');
    if (!id || !views) return;
    const v = views.views.find((x) => x.id === id);
    if (!v) return;
    if (v.filters.area) setUi({ last_board_lens: v.filters.area });
    if (v.filters.type) setType(v.filters.type);
  }, [search, views, setUi]);

  const saveView = useMutation({
    mutationFn: () =>
      api.post('/api/views', {
        name: viewName,
        surface: 'board',
        filters: { area: lens, type },
        isPinned: true,
      }),
    onSuccess: () => {
      setSaving(false);
      setViewName('');
      void qc.invalidateQueries({ queryKey: ['saved-views'] });
      toast.show('View pinned to the sidebar');
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['objects', { surface: 'board', type }],
    queryFn: () =>
      api.get<{ objects: SerializedObject[] }>(
        `/api/objects?type=${type}&type=habit&type=waiting_on&limit=400`,
      ),
  });

  const { data: areas } = useQuery({
    queryKey: ['areas'],
    queryFn: () => api.get<{ areas: { key: string; label: string }[] }>('/api/areas'),
  });

  const filtered = useMemo(() => {
    const all = data?.objects ?? [];
    if (lens === 'all') return all;
    return all.filter((o) => o.area === lens);
  }, [data, lens]);

  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-center gap-sm">
        <span className="t-micro text-ink-subtle">Lens</span>
        <Select
          ariaLabel="Board lens"
          value={lens}
          onChange={(v) => setUi({ last_board_lens: v })}
          options={[
            { value: 'all', label: 'All' },
            ...(areas?.areas ?? []).map((a) => ({ value: a.key, label: a.label })),
          ]}
          className="w-[160px]"
        />
        <Select
          ariaLabel="Type"
          value={type}
          onChange={setType}
          options={[
            { value: 'task', label: 'Tasks' },
            { value: 'milestone', label: 'Milestones' },
            { value: 'idea', label: 'Ideas' },
          ]}
          className="w-[140px]"
        />

        {saving ? (
          <form
            className="flex items-center gap-sm"
            onSubmit={(e) => {
              e.preventDefault();
              if (viewName.trim()) saveView.mutate();
            }}
          >
            <Input
              autoFocus
              value={viewName}
              placeholder="Career board"
              onChange={(e) => setViewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setSaving(false)}
              className="w-[180px]"
            />
            <Button type="submit" variant="primary" size="sm">
              Pin
            </Button>
          </form>
        ) : (
          <Button size="sm" className="ml-auto" onClick={() => setSaving(true)}>
            Save this view
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex gap-md">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[320px] w-[280px]" />
          ))}
        </div>
      ) : (
        <Board objects={filtered} />
      )}
    </div>
  );
}
