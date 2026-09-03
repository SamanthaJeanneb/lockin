import OpenAI from 'openai';
import { sql } from 'drizzle-orm';
import { env, features } from '@/lib/env';
import { db } from '@/lib/db/client';

let client: OpenAI | undefined;

function openai() {
  client ??= new OpenAI({ apiKey: env.openaiKey! });
  return client;
}

/** Returns null when embeddings are off, and every caller degrades to keyword
 *  matching rather than failing. */
export async function embed(text: string): Promise<number[] | null> {
  if (!features.embeddings || !text.trim()) return null;
  try {
    const res = await openai().embeddings.create({
      model: env.embeddingModel,
      input: text.slice(0, 8000),
    });
    return res.data[0]?.embedding ?? null;
  } catch (e) {
    console.error('[embeddings]', e);
    return null;
  }
}

export async function embedMany(texts: string[]): Promise<(number[] | null)[]> {
  if (!features.embeddings || !texts.length) return texts.map(() => null);
  try {
    const res = await openai().embeddings.create({
      model: env.embeddingModel,
      input: texts.map((t) => t.slice(0, 8000)),
    });
    return res.data.map((d) => d.embedding);
  } catch (e) {
    console.error('[embeddings]', e);
    return texts.map(() => null);
  }
}

export function toVector(v: number[]): string {
  return `[${v.join(',')}]`;
}

export async function storeObjectEmbedding(objectId: string, text: string) {
  const v = await embed(text);
  if (!v) return;
  await db.execute(
    sql`update object set embedding = ${toVector(v)}::vector where id = ${objectId}::uuid`,
  );
}

/** Cosine similarity against stored object embeddings, newest-relevant first. */
export async function similarObjects(
  userId: string,
  text: string,
  opts: { types?: string[]; limit?: number } = {},
): Promise<{ id: string; title: string; type: string; score: number }[]> {
  const v = await embed(text);
  if (!v) return [];
  const typeFilter = opts.types?.length
    ? sql`and type = any(${sql.raw(`ARRAY[${opts.types.map((t) => `'${t}'`).join(',')}]`)})`
    : sql``;
  const rows = await db.execute(sql`
    select id, title, type, 1 - (embedding <=> ${toVector(v)}::vector) as score
      from object
     where user_id = ${userId} and embedding is not null and deleted_at is null
     ${typeFilter}
     order by embedding <=> ${toVector(v)}::vector
     limit ${opts.limit ?? 12}
  `);
  return (rows as unknown as { id: string; title: string; type: string; score: string }[]).map(
    (r) => ({ id: r.id, title: r.title, type: r.type, score: Number(r.score) }),
  );
}
