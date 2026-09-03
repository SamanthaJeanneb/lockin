'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type GoalNode } from '@/lib/client-api';
import { HORIZONS, HORIZON_LABEL } from '@/lib/constants';
import { useContextPane } from '@/hooks/useContextPane';
import { GoalTree } from '@/components/views/GoalTree';
import { Button, Input, Meta, Select, Skeleton, useToast } from '@/components/ui';

interface TreeResponse {
  roots: GoalNode[];
  areas: { area: string; goals: GoalNode[]; progress: number; delta7: number }[];
}

export default function GoalTreePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { open } = useContextPane();
  const [adding, setAdding] = useState<{ parentId: string | null; area: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [horizon, setHorizon] = useState<string>('1y');

  const { data, isLoading } = useQuery({
    queryKey: ['goal-tree'],
    queryFn: () => api.get<TreeResponse>('/api/goals/tree'),
  });

  const { data: identity } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<{ user: { identityStatement: string | null } }>('/api/settings'),
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ object: { id: string } }>('/api/objects', {
        type: 'goal',
        title: draft,
        area: adding?.area,
        horizon,
        status: 'active',
        ...(adding?.parentId ? { linkTo: { id: adding.parentId, rel: 'supports' } } : {}),
      });
      return res.object.id;
    },
    onSuccess: (id) => {
      setDraft('');
      setAdding(null);
      void qc.invalidateQueries({ queryKey: ['goal-tree'] });
      toast.show('Goal added');
      open(id);
    },
  });

  const reparent = useMutation({
    mutationFn: ({ childId, parentId }: { childId: string; parentId: string }) =>
      api.post('/api/edges', { fromId: childId, toId: parentId, rel: 'supports' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['goal-tree'] });
      toast.show('Reparented');
    },
  });

  return (
    <div className="flex flex-col gap-lg">
      {identity?.user.identityStatement ? (
        <p className="t-body max-w-measure text-ink-muted">
          “{identity.user.identityStatement}”
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-xs">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-row-compact w-full" />
          ))}
        </div>
      ) : (
        <GoalTree
          areas={data?.areas ?? []}
          onAddChild={(parentId, area) => setAdding({ parentId, area })}
          onReparent={(childId, parentId) => reparent.mutate({ childId, parentId })}
        />
      )}

      {adding ? (
        <form
          className="flex flex-col gap-sm border-t border-hairline pt-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) create.mutate();
          }}
        >
          <Meta>
            Type a sentence. Horizon, area and metric are filled in as suggestions you can change.
          </Meta>
          <div className="flex gap-sm">
            <Input
              autoFocus
              value={draft}
              placeholder="I want $1M invested by 35"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setAdding(null)}
            />
            <Select
              ariaLabel="Horizon"
              value={horizon}
              onChange={setHorizon}
              options={HORIZONS.map((h) => ({ value: h, label: HORIZON_LABEL[h] }))}
              className="w-[140px]"
            />
            <Button type="submit" variant="primary" disabled={!draft.trim()}>
              Add
            </Button>
            <Button type="button" onClick={() => setAdding(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button className="self-start" onClick={() => setAdding({ parentId: null, area: 'career' })}>
          + Add goal
        </Button>
      )}
    </div>
  );
}
