import Anthropic from '@anthropic-ai/sdk';
import { env, features } from '@/lib/env';

let client: Anthropic | undefined;

export function anthropic(): Anthropic {
  if (!features.ai) {
    throw new Error('ANTHROPIC_API_KEY is not configured — AI features are off. See SETUP.md.');
  }
  client ??= new Anthropic({ apiKey: env.anthropicKey!, maxRetries: 2, timeout: 120_000 });
  return client;
}

export interface AskOptions {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

/**
 * The Claude 5 family rejects `temperature` outright — a 400 reading
 * "`temperature` is deprecated for this model". Sending it unconditionally made
 * every call fail, and because the failure was swallowed it looked exactly like
 * "the model found nothing".
 */
function supportsTemperature(model: string): boolean {
  return !/claude-(opus|sonnet|haiku|fable|mythos)-5/i.test(model);
}

function isParamError(e: unknown, param: string): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return new RegExp(param, 'i').test(message) && /deprecat|not support|unsupported/i.test(message);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const status = (e as { status?: number }).status;
      if (status && status < 500 && status !== 429) break;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw lastError;
}

export async function askText(opts: AskOptions): Promise<string> {
  const model = opts.model ?? env.anthropicModel;

  const build = (withTemperature: boolean) => ({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    ...(withTemperature && opts.temperature !== undefined
      ? { temperature: opts.temperature }
      : {}),
    system: opts.system,
    messages: [{ role: 'user' as const, content: opts.user }],
  });

  const res = await withRetry(async () => {
    try {
      return await anthropic().messages.create(build(supportsTemperature(model)));
    } catch (e) {
      // Belt and braces: if a model rejects temperature and the name check
      // missed it, drop the parameter and try once rather than failing.
      if (isParamError(e, 'temperature')) return anthropic().messages.create(build(false));
      throw e;
    }
  });

  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

/**
 * Structured output.
 *
 * When a JSON schema is supplied the API is constrained to it, so the response
 * is valid by construction. This replaced an assistant-prefill trick that the
 * Claude 5 family rejects outright ("This model does not support assistant
 * message prefill"), and which only ever coaxed JSON rather than guaranteeing it.
 *
 * Without a schema it falls back to asking plainly and repairing the reply,
 * which still handles a fenced or chatty response.
 *
 * A malformed reply degrades to `fallback`. A failed *call* throws, so callers
 * can record why — an empty result and a 400 are different problems and must
 * not look the same.
 */
export async function askJson<T>(
  opts: AskOptions & { fallback: T; schema?: Record<string, unknown> },
): Promise<T> {
  const model = opts.model ?? env.anthropicModel;

  if (opts.schema) {
    // The format object is built here rather than with the SDK's
    // `jsonSchemaOutputFormat` helper: that helper rewrites the schema before
    // sending it, and its subpath import is one of the packages this project's
    // directory name breaks (see tsconfig `paths`). A literal format is both
    // simpler and exactly what the API documents.
    const res = await withRetry(() =>
      anthropic().messages.create({
        model,
        max_tokens: opts.maxTokens ?? 4096,
        system: opts.system,
        messages: [{ role: 'user', content: opts.user }],
        output_config: { format: { type: 'json_schema', schema: opts.schema! } },
      }),
    );
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return parseJson<T>(text, opts.fallback);
  }

  const raw = await askText({
    ...opts,
    system: `${opts.system}\n\nReturn only the JSON object. No prose, no markdown fence.`,
  });
  return parseJson<T>(raw, opts.fallback);
}

/** For callers that would rather degrade than fail. */
export async function askJsonSafe<T>(
  opts: AskOptions & { fallback: T; schema?: Record<string, unknown> },
): Promise<T> {
  try {
    return await askJson(opts);
  } catch (e) {
    console.error('[ai] structured call failed', e);
    return opts.fallback;
  }
}

export function parseJson<T>(raw: string, fallback: T): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Recover the outermost balanced object.
    const start = cleaned.indexOf('{');
    if (start === -1) return fallback;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < cleaned.length; i++) {
      const c = cleaned[i]!;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === '\\') {
        escaped = true;
        continue;
      }
      if (c === '"') inString = !inString;
      if (inString) continue;
      if (c === '{') depth++;
      if (c === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(cleaned.slice(start, i + 1)) as T;
          } catch {
            return fallback;
          }
        }
      }
    }
    return fallback;
  }
}
