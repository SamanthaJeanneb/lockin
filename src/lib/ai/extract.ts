import { and, eq, isNull, sql } from 'drizzle-orm';
import { addDays, formatISO, nextDay, parseISO, startOfDay, type Day } from 'date-fns';
import { db } from '@/lib/db/client';
import { capture, edge, object, type Extraction, type ExtractionObject } from '@/lib/db/schema';
import { askJson } from './client';
import { EXTRACTION_SYSTEM } from './prompts';
import { promptContext } from './context';
import { storeObjectEmbedding } from './embeddings';
import { getUserForJob } from '@/lib/db/queries';
import { duplicateCandidates } from './match';

const EMPTY: Extraction = {
  objects: [],
  edges: [],
  updates: [],
  completions: [],
  not_done: [],
  expenses: [],
  journal: null,
  questions: [],
};

/** Store-first, extract-second. Called from the queue, never from the request
 *  that saved the capture — that one returns in under 100ms. */
export async function extractCapture(captureId: string): Promise<Extraction> {
  const [row] = await db.select().from(capture).where(eq(capture.id, captureId)).limit(1);
  if (!row) throw new Error('Capture not found');

  const text = [row.rawText, row.transcript].filter(Boolean).join('\n').trim();
  if (!text) {
    await db
      .update(capture)
      .set({ extraction: EMPTY, processedAt: new Date() })
      .where(eq(capture.id, captureId));
    return EMPTY;
  }

  const user = await getUserForJob(row.userId);
  const ctx = await promptContext(row.userId, {
    identity: user?.identityStatement,
    timezone: user?.timezone,
    withPeople: true,
  });

  let result: Extraction;
  try {
    result = normalise(
      await askJson<Extraction>({
        system: EXTRACTION_SYSTEM(ctx),
        user: text,
        maxTokens: 3000,
        fallback: EMPTY,
      }),
    );
  } catch (e) {
    // Store the raw text and retry later. Nothing the user typed is ever lost.
    await db
      .update(capture)
      .set({ error: e instanceof Error ? e.message : 'extraction failed', attempts: row.attempts + 1 })
      .where(eq(capture.id, captureId));
    throw e;
  }

  // Duplicate detection before anything is offered to the user.
  for (const o of result.objects) {
    const candidates = await duplicateCandidates(row.userId, o.type, o.title);
    const best = candidates[0];
    if (best && best.score >= 0.85) {
      o.match = { object_id: best.id, candidates };
    } else {
      o.match = { object_id: null, candidates: candidates.filter((c) => c.score >= 0.6) };
    }
  }

  await db
    .update(capture)
    .set({ extraction: result, processedAt: new Date(), error: null })
    .where(eq(capture.id, captureId));

  return result;
}

function normalise(raw: Extraction): Extraction {
  const out: Extraction = { ...EMPTY, ...raw };
  out.objects = (raw.objects ?? []).filter((o) => o?.title && o?.type).map((o, i) => ({
    ...o,
    tmp: o.tmp || `o${i + 1}`,
    confidence: typeof o.confidence === 'number' ? o.confidence : 0.7,
    due_at: o.due_at ? resolveDate(o.due_at) : null,
  }));
  out.edges = (raw.edges ?? []).filter((e) => e?.from && e?.to && e?.rel);
  out.completions = (raw.completions ?? []).filter((c) => c?.object_id);
  out.not_done = (raw.not_done ?? []).filter((n) => n?.object_id);
  out.expenses = (raw.expenses ?? []).filter((e) => typeof e?.amount === 'number');
  out.updates = (raw.updates ?? []).filter((u) => u?.object_id);
  out.questions = raw.questions ?? [];
  return out;
}

const WEEKDAYS: Record<string, Day> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

/** "tomorrow", "tuesday", "2026-09-08" all resolve to an ISO timestamp. */
export function resolveDate(input: string, from = new Date()): string | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (s === 'today') return formatISO(startOfDay(from));
  if (s === 'tomorrow') return formatISO(startOfDay(addDays(from, 1)));
  if (s === 'next week') return formatISO(startOfDay(addDays(from, 7)));
  if (s === 'someday') return null;
  if (s === 'weekend') return formatISO(startOfDay(nextDay(from, 6)));
  if (s in WEEKDAYS) return formatISO(startOfDay(nextDay(from, WEEKDAYS[s]!)));
  try {
    const d = parseISO(input);
    if (!Number.isNaN(d.getTime())) return formatISO(d);
  } catch {
    /* fall through */
  }
  return null;
}

export interface ResolveInput {
  userId: string;
  captureId: string;
  accept: string[]; // tmp ids the user kept
  edits?: Record<string, Partial<ExtractionObject>>;
  noteOnly?: boolean;
}

/** Turn accepted extraction rows into real objects and edges. */
export async function resolveCapture(input: ResolveInput) {
  const [row] = await db.select().from(capture).where(eq(capture.id, input.captureId)).limit(1);
  if (!row || row.userId !== input.userId) throw new Error('Capture not found');
  const extraction = (row.extraction ?? EMPTY) as Extraction;

  const created: { tmp: string; id: string; type: string; title: string }[] = [];
  const tmpToId = new Map<string, string>();

  if (!input.noteOnly) {
    for (const proposed of extraction.objects) {
      if (!input.accept.includes(proposed.tmp)) continue;
      const o = { ...proposed, ...(input.edits?.[proposed.tmp] ?? {}) };

      // A confident duplicate updates the existing row instead of creating one.
      if (o.match?.object_id) {
        tmpToId.set(o.tmp, o.match.object_id);
        const merged = { ...(o.props ?? {}) };
        if (Object.keys(merged).length) {
          await db
            .update(object)
            .set({ props: sql`${object.props} || ${JSON.stringify(merged)}::jsonb` })
            .where(and(eq(object.id, o.match.object_id), eq(object.userId, input.userId)));
        }
        continue;
      }

      const inferred = ['area', 'due_at', 'status', 'estimate_minutes'].filter(
        (k) => (o as Record<string, unknown>)[k] != null,
      );

      const [inserted] = await db
        .insert(object)
        .values({
          userId: input.userId,
          type: o.type,
          title: o.title,
          status: o.status ?? null,
          area: o.area ?? null,
          dueAt: o.due_at ? new Date(o.due_at) : null,
          estimateMinutes: o.estimate_minutes ?? null,
          props: (o.props ?? {}) as Record<string, unknown>,
          confidence: o.confidence?.toString(),
          inferredFields: inferred,
          sourceCaptureId: input.captureId,
        })
        .returning({ id: object.id });

      tmpToId.set(o.tmp, inserted!.id);
      created.push({ tmp: o.tmp, id: inserted!.id, type: o.type, title: o.title });
      void storeObjectEmbedding(inserted!.id, `${o.title} ${JSON.stringify(o.props ?? {})}`);
    }

    for (const e of extraction.edges) {
      const fromId = tmpToId.get(e.from) ?? (isUuid(e.from) ? e.from : null);
      const toId = tmpToId.get(e.to) ?? (isUuid(e.to) ? e.to : null);
      if (!fromId || !toId || fromId === toId) continue;
      await db
        .insert(edge)
        .values({
          userId: input.userId,
          fromId,
          toId,
          rel: e.rel,
          confidence: e.confidence?.toString(),
        })
        .onConflictDoNothing();
    }
  }

  // Raw text always survives as a journal-adjacent note, even in note-only mode.
  if (input.noteOnly && row.rawText) {
    const [note] = await db
      .insert(object)
      .values({
        userId: input.userId,
        type: 'note',
        title: row.rawText.split('\n')[0]!.slice(0, 80),
        body: row.rawText,
        sourceCaptureId: input.captureId,
      })
      .returning({ id: object.id });
    created.push({ tmp: 'note', id: note!.id, type: 'note', title: 'Note' });
  }

  await db.update(capture).set({ resolvedAt: new Date() }).where(eq(capture.id, input.captureId));
  return { created, tmpToId: Object.fromEntries(tmpToId) };
}

export function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
