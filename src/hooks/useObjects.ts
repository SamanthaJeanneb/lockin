'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type SerializedObject } from '@/lib/client-api';
import { useToast } from '@/components/ui';

export const objectKeys = {
  all: ['objects'] as const,
  list: (params: Record<string, unknown>) => ['objects', params] as const,
  detail: (id: string) => ['object', id] as const,
  today: ['today'] as const,
};

export function useObjectList(params: Record<string, string | undefined>) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null) as [string, string][],
  ).toString();
  return useQuery({
    queryKey: objectKeys.list(params),
    queryFn: () => api.get<{ objects: SerializedObject[] }>(`/api/objects?${search}`),
    staleTime: 15_000,
  });
}

export function useObject(id: string | null) {
  return useQuery({
    queryKey: objectKeys.detail(id ?? ''),
    queryFn: () =>
      api.get<{
        object: SerializedObject;
        edges: { edge: { id: string; rel: string }; direction: 'in' | 'out'; other: SerializedObject }[];
        why: { id: string; title: string; type: string }[];
      }>(`/api/objects/${id}`),
    enabled: Boolean(id),
  });
}

export function useUpdateObject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api.patch<{ object: SerializedObject }>(`/api/objects/${id}`, patch),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: objectKeys.all });
      void qc.invalidateQueries({ queryKey: objectKeys.detail(vars.id) });
      void qc.invalidateQueries({ queryKey: objectKeys.today });
    },
  });
}

export function useCreateObject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<{ object: SerializedObject }>('/api/objects', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: objectKeys.all }),
  });
}

/**
 * Completion feels instantaneous because the cache is written before the
 * request leaves. The toast carries the undo, which is a real PATCH back.
 */
export function useOptimisticComplete() {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean; title?: string }) =>
      api.patch<{ object: SerializedObject; deltas?: Record<string, number> }>(`/api/objects/${id}`, {
        completedAt: completed ? new Date().toISOString() : null,
        status: completed ? 'done' : 'today',
      }),

    onMutate: async ({ id, completed }) => {
      await qc.cancelQueries({ queryKey: objectKeys.all });
      const snapshots = qc.getQueriesData({ queryKey: objectKeys.all });
      qc.setQueriesData<{ objects: SerializedObject[] }>({ queryKey: objectKeys.all }, (old) =>
        old
          ? {
              ...old,
              objects: old.objects.map((o) =>
                o.id === id
                  ? { ...o, completedAt: completed ? new Date().toISOString() : null, status: completed ? 'done' : 'today' }
                  : o,
              ),
            }
          : old,
      );
      return { snapshots };
    },

    onError: (_e, _vars, ctx) => {
      for (const [key, data] of ctx?.snapshots ?? []) qc.setQueryData(key, data);
    },

    onSuccess: (_data, vars) => {
      if (vars.completed) {
        toast.show(vars.title ? `${vars.title} — done` : 'Completed', async () => {
          await api.patch(`/api/objects/${vars.id}`, { completedAt: null, status: 'today' });
          void qc.invalidateQueries({ queryKey: objectKeys.all });
          void qc.invalidateQueries({ queryKey: objectKeys.today });
        });
      }
      void qc.invalidateQueries({ queryKey: objectKeys.today });
      void qc.invalidateQueries({ queryKey: ['areas'] });
      void qc.invalidateQueries({ queryKey: ['goal-tree'] });
    },
  });
}

export function useDeleteObject() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => api.del<{ undoToken: string }>(`/api/objects/${id}`),
    onSuccess: (data, id) => {
      void qc.invalidateQueries({ queryKey: objectKeys.all });
      toast.show('Deleted', async () => {
        await api.post(`/api/objects/${id}/restore`, { token: data.undoToken });
        void qc.invalidateQueries({ queryKey: objectKeys.all });
      });
    },
  });
}

export function useBulkAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { ids: string[]; action: string; payload?: Record<string, unknown> }) =>
      api.post<{ updated: number }>('/api/objects/bulk', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: objectKeys.all }),
  });
}
