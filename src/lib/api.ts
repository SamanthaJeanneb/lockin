import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { Unauthorized } from '@/lib/auth';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** One error shape for every route. AI and integration failures degrade to 503
 *  with a message the UI shows verbatim, rather than a stack trace. */
export function handleError(e: unknown) {
  if (e instanceof Unauthorized) return fail('Not signed in', 401);
  if (e instanceof ZodError) {
    return fail('Invalid request', 422, { issues: e.issues });
  }
  const message = e instanceof Error ? e.message : 'Something went wrong';
  if (/not configured/i.test(message)) return fail(message, 503);
  console.error('[api]', e);
  return fail(message, 500);
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  return schema.parse(raw);
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const url = new URL(req.url);
  const obj: Record<string, string | string[]> = {};
  for (const [k, v] of url.searchParams.entries()) {
    const existing = obj[k];
    if (existing === undefined) obj[k] = v;
    else if (Array.isArray(existing)) existing.push(v);
    else obj[k] = [existing, v];
  }
  return schema.parse(obj);
}

/** Simple per-user token bucket. Capture and AI routes are the ones that cost
 *  money, so they are the ones that are limited. */
const buckets = new Map<string, { tokens: number; last: number }>();

export function rateLimit(key: string, perMinute: number): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: perMinute, last: now };
  const refill = ((now - b.last) / 60_000) * perMinute;
  b.tokens = Math.min(perMinute, b.tokens + refill);
  b.last = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  return true;
}

export function tooMany() {
  return fail('Slow down for a moment — too many requests.', 429);
}
