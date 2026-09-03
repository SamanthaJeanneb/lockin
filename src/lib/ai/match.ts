import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { object } from '@/lib/db/schema';
import { embed, similarObjects, toVector } from './embeddings';

const COMPLETION_VERBS = [
  'finished','done','completed','sent','pushed','shipped','deployed','called','emailed',
  'ran','wrote','submitted','applied','paid','booked','fixed','met','talked','read',
  'launched','published','filed','closed','delivered','handled','sorted','cleaned',
];

const STOPWORDS = new Set([
  'the','a','an','to','of','and','for','on','in','with','my','i','is','was','it','at',
  'this','that','be','have','had','got','get','do','did','from','out','up','about',
]);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export function keywordOverlap(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (!ta.size || !tb.size) return 0;
  let hits = 0;
  for (const w of tb) if (ta.has(w)) hits++;
  return hits / Math.min(ta.size, tb.size);
}

/** How close a completion verb sits to the item's own words in the text. */
export function verbProximity(text: string, title: string): number {
  const words = text.toLowerCase().split(/\s+/);
  const titleWords = new Set(tokenize(title));
  let best = Infinity;
  words.forEach((w, i) => {
    const bare = w.replace(/[^a-z]/g, '');
    if (!COMPLETION_VERBS.includes(bare)) return;
    words.forEach((w2, j) => {
      if (titleWords.has(w2.replace(/[^a-z0-9]/g, ''))) best = Math.min(best, Math.abs(i - j));
    });
  });
  if (best === Infinity) return 0;
  return Math.max(0, 1 - best / 12);
}

export function recencyScore(updatedAt: Date | string | null, status: string | null): number {
  let s = 0;
  if (status === 'today' || status === 'doing') s += 0.6;
  else if (status === 'next') s += 0.3;
  if (updatedAt) {
    const days = (Date.now() - new Date(updatedAt).getTime()) / 86_400_000;
    s += Math.max(0, 0.4 - days / 30);
  }
  return Math.min(1, s);
}

export interface Candidate {
  id: string;
  type: string;
  title: string;
  status: string | null;
  unit: string | null;
  score: number;
  evidence: string;
}

/**
 * 0.55 embedding + 0.25 keyword + 0.10 recency + 0.10 completion-verb proximity.
 * Without an embeddings key the weight redistributes to keyword overlap so the
 * debrief still works, just less sharply.
 */
export async function matchDebrief(userId: string, text: string): Promise<Candidate[]> {
  const rows = await db
    .select({
      id: object.id,
      type: object.type,
      title: object.title,
      status: object.status,
      unit: object.unit,
      updatedAt: object.updatedAt,
      dueAt: object.dueAt,
    })
    .from(object)
    .where(
      and(
        eq(object.userId, userId),
        isNull(object.deletedAt),
        isNull(object.completedAt),
        sql`${object.type} in ('task','habit','milestone','waiting_on')`,
        sql`(${object.status} in ('today','doing','next','waiting','active')
             or ${object.dueAt} < now() + interval '1 day')`,
      ),
    )
    .limit(200);

  if (!rows.length) return [];

  const vector = await embed(text);
  const semantic = new Map<string, number>();
  if (vector) {
    const ids = rows.map((r) => r.id);
    const sims = await db.execute(sql`
      select id, 1 - (embedding <=> ${toVector(vector)}::vector) as score
        from object
       where user_id = ${userId}
         and embedding is not null
         and id = any(${sql.raw(`ARRAY[${ids.map((i) => `'${i}'::uuid`).join(',')}]`)})
    `);
    for (const r of sims as unknown as { id: string; score: string }[]) {
      semantic.set(r.id, Number(r.score));
    }
  }

  const hasEmbeddings = semantic.size > 0;

  return rows
    .map((r) => {
      const kw = keywordOverlap(text, r.title);
      const sem = semantic.get(r.id) ?? 0;
      const rec = recencyScore(r.updatedAt, r.status);
      const verb = verbProximity(text, r.title);
      const score = hasEmbeddings
        ? 0.55 * sem + 0.25 * kw + 0.1 * rec + 0.1 * verb
        : 0.7 * kw + 0.15 * rec + 0.15 * verb;
      return {
        id: r.id,
        type: r.type,
        title: r.title,
        status: r.status,
        unit: r.unit,
        score: Number(score.toFixed(3)),
        evidence: evidenceFor(text, r.title),
      };
    })
    .filter((c) => c.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

function evidenceFor(text: string, title: string): string {
  const words = new Set(tokenize(title));
  const sentence = text
    .split(/(?<=[.!?])\s+/)
    .find((s) => tokenize(s).some((w) => words.has(w)));
  return (sentence ?? '').trim().slice(0, 120);
}

/** "ran 4 miles" → { value: 4, unit: 'mi' } */
const UNIT_ALIASES: Record<string, string> = {
  mile: 'mi', miles: 'mi', mi: 'mi', km: 'km', kilometre: 'km', kilometres: 'km',
  kilometer: 'km', kilometers: 'km', minute: 'min', minutes: 'min', min: 'min',
  hour: 'h', hours: 'h', hr: 'h', page: 'pages', pages: 'pages', rep: 'reps',
  reps: 'reps', set: 'sets', sets: 'sets', lb: 'lb', lbs: 'lb', kg: 'kg', step: 'steps',
  steps: 'steps', word: 'words', words: 'words', glass: 'glasses', glasses: 'glasses',
};

export function extractQuantity(text: string): { value: number; unit: string } | null {
  const m = text.match(
    /(\d+(?:\.\d+)?)\s*(miles?|mi|km|kilometres?|kilometers?|minutes?|min|hours?|hr|pages?|reps?|sets?|lbs?|lb|kg|steps?|words?|glass(?:es)?)\b/i,
  );
  if (!m) return null;
  return { value: Number(m[1]), unit: UNIT_ALIASES[m[2]!.toLowerCase()] ?? m[2]!.toLowerCase() };
}

export function extractAmount(text: string): number | null {
  const m = text.match(/\$\s?(\d[\d,]*(?:\.\d{2})?)|(\d[\d,]*(?:\.\d{2})?)\s?(?:dollars|bucks|usd)/i);
  if (!m) return null;
  return Number((m[1] ?? m[2]!).replace(/,/g, ''));
}

/**
 * Duplicate detection: trigram similarity on the title, embedding cosine, and a
 * type match. Above 0.85 merges silently; 0.6–0.85 asks inline; below creates new.
 */
export async function duplicateCandidates(
  userId: string,
  type: string,
  title: string,
): Promise<{ id: string; title: string; score: number }[]> {
  const trigram = await db.execute(sql`
    select id, title, similarity(title, ${title}) as score
      from object
     where user_id = ${userId} and type = ${type} and deleted_at is null
       and similarity(title, ${title}) > 0.3
     order by score desc limit 5
  `);
  const byId = new Map<string, { id: string; title: string; score: number }>();
  for (const r of trigram as unknown as { id: string; title: string; score: string }[]) {
    byId.set(r.id, { id: r.id, title: r.title, score: Number(r.score) });
  }

  const semantic = await similarObjects(userId, title, { types: [type], limit: 5 });
  for (const s of semantic) {
    const existing = byId.get(s.id);
    // Two independent signals agreeing is worth more than either alone.
    const combined = existing ? Math.min(1, existing.score * 0.5 + s.score * 0.7) : s.score * 0.85;
    byId.set(s.id, { id: s.id, title: s.title, score: Number(combined.toFixed(3)) });
  }

  return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, 5);
}
