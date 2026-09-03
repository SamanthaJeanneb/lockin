'use client';
import type { ObjectRecord } from '@/lib/db/schema';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/* ── Typed shapes shared with the server routes ───────────────────────────── */

export interface SerializedObject
  extends Omit<
    ObjectRecord,
    'createdAt' | 'updatedAt' | 'dueAt' | 'completedAt' | 'startAt' | 'snoozeUntil' | 'scheduledStart' | 'scheduledEnd' | 'archivedAt' | 'deletedAt'
  > {
  createdAt: string;
  updatedAt: string;
  dueAt: string | null;
  completedAt: string | null;
  startAt: string | null;
  snoozeUntil: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  archivedAt: string | null;
  deletedAt: string | null;
}

export interface TodayItem {
  object: SerializedObject;
  why: string;
  unblocks: number;
  blockedBy: { id: string; title: string }[];
  suggestedSlot: { start: string; end: string } | null;
  goalPath: { id: string; title: string; type: string }[];
}

export interface AreaProgress {
  key: string;
  label: string;
  series: number;
  priority: number | null;
  value: number;
  delta: number;
}

export interface DebriefMatch {
  id: string;
  type: string;
  title: string;
  status: string | null;
  score: number;
  evidence: string;
  effect?: string | null;
  value?: number | null;
  unit?: string | null;
}

export interface DebriefResult {
  captureId: string;
  matches: DebriefMatch[];
  notDone: { id: string; title: string; snoozeTo: string }[];
  newObjects: { tmp: string; type: string; title: string; props?: Record<string, unknown> }[];
  expenses: { amount: number; merchant: string; category: string }[];
  journal: { body: string; mood: string | null; themes: string[] } | null;
}

export interface GoalNode {
  id: string;
  parentId: string | null;
  depth: number;
  title: string;
  area: string | null;
  horizon: string | null;
  progress: number;
  dueAt: string | null;
  status: string | null;
  trajectory: string;
  delta7: number;
  children: GoalNode[];
}

export interface RoadmapBar {
  id: string;
  title: string;
  area: string | null;
  start: string;
  end: string;
  progress: number;
  milestones: { id: string; title: string; at: string; reached: boolean }[];
}
