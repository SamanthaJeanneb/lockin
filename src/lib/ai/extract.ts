import { and, eq, isNull, sql } from 'drizzle-orm';
import { addDays, formatISO, nextDay, parseISO, startOfDay, type Day } from 'date-fns';
import { db } from '@/lib/db/client';
import {
  capture, edge, object, transaction, type Extraction, type ExtractionObject,
} from '@/lib/db/schema';
import { completeObjects } from '@/lib/objects/complete';
import { askJson } from './client';
import { EXTRACTION_SYSTEM } from './prompts';
import { EXTRACTION_SCHEMA } from './schemas';
import { promptContext } from './context';
import { storeObjectEmbedding } from './embeddings';
import { getUserForJob } from '@/lib/db/queries';
import { duplicateCandidates, matchDebrief } from './match';
import { mentionsPrompt, resolveMentions } from './mentions';

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

  // @mentions are resolved before the model sees the text, so a deliberate
  // reference to an existing record is a fact in the prompt rather than
  // something the model has to spot.
  const { mentions, unresolved } = await resolveMentions(row.userId, text);
  const mentionBlock = mentionsPrompt(mentions, unresolved);

  let result: Extraction;
  try {
    result = normalise(
      await askJson<Extraction>({
        system: EXTRACTION_SYSTEM(ctx) + (mentionBlock ? `\n\n${mentionBlock}` : ''),
        user: text,
        maxTokens: 8000,
        effort: 'low',
        schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
        fallback: EMPTY,
      }),
    );
  } catch (e) {
    // The raw text is already saved, so nothing is lost. Mark it processed with
    // the reason attached: a failed call and an empty result are different
    // problems and must not look the same to the user.
    await db
      .update(capture)
      .set({
        error: e instanceof Error ? e.message : 'extraction failed',
        attempts: row.attempts + 1,
        processedAt: new Date(),
        extraction: EMPTY,
      })
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

  // Completion detection runs twice and takes the better answer. The scoring
  // engine catches things the model misses, and works even with no key at all;
  // the model catches phrasings that share no words with the item's title.
  // "finished portfolio homepage" must tick the task off whichever field it was
  // typed into, so capture gets the same treatment the debrief does.
  try {
    const scored = await matchDebrief(row.userId, text);
    for (const m of scored) {
      if (m.score < 0.5) continue;
      const existing = result.completions.find((c) => c.object_id === m.id);
      if (existing) {
        existing.confidence = Math.max(existing.confidence, m.score);
        existing.evidence ||= m.evidence;
      } else {
        result.completions.push({
          object_id: m.id,
          confidence: m.score,
          evidence: m.evidence,
        });
      }
    }
  } catch (e) {
    console.error('[extract] completion matching failed', e);
  }

  // A completion and a new object for the same thing is a duplicate; the
  // completion wins, because the item already exists.
  if (result.completions.length) {
    result.objects = result.objects.filter(
      (o) => !['task', 'milestone', 'habit', 'waiting_on'].includes(o.type),
    );
  }

  // Enforce the mention links rather than trusting them: if the model created
  // an object for something the user @-mentioned, point the edge at the record
  // they meant.
  if (mentions.length) {
    const known = new Set(mentions.map((m) => m.id));
    for (const m of mentions) {
      const referenced = result.edges.some((e) => e.to === m.id || e.from === m.id);
      if (referenced) continue;
      const subject = result.objects.find((o) =>
        ['interaction', 'task', 'note', 'journal', 'waiting_on', 'experience'].includes(o.type),
      );
      if (subject) {
        result.edges.push({
          from: subject.tmp,
          to: m.id,
          rel: m.type === 'person' || m.type === 'group' ? 'with' : 'about',
          confidence: 0.95,
        });
      }
    }
    // Never propose creating something the user pointed at by name.
    result.objects = result.objects.filter(
      (o) => !mentions.some((m) => known.has(m.id) && m.title.toLowerCase() === o.title.toLowerCase()),
    );
  }

  await db
    .update(capture)
    .set({ extraction: result, processedAt: new Date(), error: null })
    .where(eq(capture.id, captureId));

  return result;
}

/** Fold the key/value pairs a strict schema forces back into a plain object. */
export function fromPropertyBag(
  bag: unknown,
): Record<string, unknown> {
  if (Array.isArray(bag)) {
    const out: Record<string, unknown> = {};
    for (const entry of bag) {
      if (entry && typeof entry === 'object' && 'key' in entry && 'value' in entry) {
        const { key, value } = entry as { key: string; value: string };
        if (!key) continue;
        // A comma-separated value is almost always a list the model flattened.
        // Values arrive as strings because the schema demands it. Restore the
        // obvious types so a habit target is a number and a list is a list.
        if (/,\s/.test(value)) out[key] = value.split(/,\s*/).filter(Boolean);
        else if (/^-?\d+(\.\d+)?$/.test(value.trim())) out[key] = Number(value);
        else if (/^(true|false)$/i.test(value.trim())) out[key] = value.trim().toLowerCase() === 'true';
        else out[key] = value;
      }
    }
    return out;
  }
  return bag && typeof bag === 'object' ? (bag as Record<string, unknown>) : {};
}

function emptyToNull(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  return t === '' || t === 'none' || t === 'null' || t === 'n/a' || t === 'unspecified' ? null : v;
}

function normalise(raw: Extraction): Extraction {
  const out: Extraction = { ...EMPTY, ...raw };
  out.objects = (raw.objects ?? []).filter((o) => o?.title && o?.type).map((o, i) => ({
    ...o,
    tmp: o.tmp || `o${i + 1}`,
    props: fromPropertyBag(o.props),
    // Models write "none"/"null"/"n/a" where the schema wanted null, and those
    // strings would otherwise become real statuses and break every filter.
    status: emptyToNull(o.status),
    area: emptyToNull(o.area),
    confidence: typeof o.confidence === 'number' ? o.confidence : 0.7,
    due_at: o.due_at ? resolveDate(o.due_at) : null,
  }));
  out.edges = (raw.edges ?? []).filter((e) => e?.from && e?.to && e?.rel);
  out.completions = (raw.completions ?? []).filter((c) => c?.object_id);
  out.not_done = (raw.not_done ?? []).filter((n) => n?.object_id);
  out.expenses = (raw.expenses ?? []).filter((e) => typeof e?.amount === 'number');
  out.updates = (raw.updates ?? [])
    .filter((u) => u?.object_id)
    .map((u) => ({ ...u, set: fromPropertyBag(u.set) }));
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
  /** tmp ids of proposed objects the user kept */
  accept: string[];
  /** object ids the user confirmed as completed */
  complete?: string[];
  /** object ids to snooze rather than complete */
  snooze?: string[];
  /** indices of the proposed expenses the user kept */
  expenses?: number[];
  /** whether to save the raw text as a journal entry */
  journal?: boolean;
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

  // Completing what the text said was finished is the whole point of typing it.
  const completion = await completeObjects(
    input.userId,
    (input.complete ?? []).map((id) => ({ id })),
  );

  for (const id of input.snooze ?? []) {
    await db
      .update(object)
      .set({ snoozeUntil: addDays(new Date(), 1) })
      .where(and(eq(object.userId, input.userId), eq(object.id, id)));
  }

  const keptExpenses = (input.expenses ?? []).map((i) => extraction.expenses[i]).filter(Boolean);
  for (const e of keptExpenses) {
    const [expense] = await db
      .insert(object)
      .values({
        userId: input.userId,
        type: 'expense',
        title: `${e.merchant} — $${e.amount}`,
        area: 'finance',
        props: { amount: e.amount, merchant: e.merchant, category: e.category },
        sourceCaptureId: input.captureId,
      })
      .returning({ id: object.id });
    await db.insert(transaction).values({
      userId: input.userId,
      postedAt: new Date().toISOString().slice(0, 10),
      amount: (-Math.abs(e.amount)).toString(),
      merchant: e.merchant,
      description: e.merchant,
      category: e.category,
      categorySource: 'ai',
      objectId: expense!.id,
    });
    created.push({ tmp: `expense-${e.merchant}`, id: expense!.id, type: 'expense', title: e.merchant });
  }

  if (input.journal && extraction.journal?.body?.trim()) {
    const [j] = await db
      .insert(object)
      .values({
        userId: input.userId,
        type: 'journal',
        title: extraction.journal.body.split('\n')[0]!.slice(0, 80),
        body: extraction.journal.body,
        props: { mood: extraction.journal.mood, themes: extraction.journal.themes },
        sourceCaptureId: input.captureId,
      })
      .returning({ id: object.id });
    created.push({ tmp: 'journal', id: j!.id, type: 'journal', title: 'Journal entry' });
    void storeObjectEmbedding(j!.id, extraction.journal.body);
  }

  await db.update(capture).set({ resolvedAt: new Date() }).where(eq(capture.id, input.captureId));

  const summary: string[] = [];
  if (created.length) summary.push(`${created.length} added`);
  summary.push(...completion.summary);

  return {
    created,
    completed: completion.completed,
    deltas: completion.deltas,
    summary,
    tmpToId: Object.fromEntries(tmpToId),
  };
}

export function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
