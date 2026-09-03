import Anthropic from '@anthropic-ai/sdk';
import { env, features } from '@/lib/env';

let client: Anthropic | undefined;

export function anthropic(): Anthropic {
  if (!features.ai) {
    throw new Error('ANTHROPIC_API_KEY is not configured — AI features are off. See SETUP.md.');
  }
  client ??= new Anthropic({ apiKey: env.anthropicKey!, maxRetries: 2, timeout: 60_000 });
  return client;
}

export interface AskOptions {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  /** Seeds the assistant turn so the model continues valid JSON instead of prose. */
  prefill?: string;
  model?: string;
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
  const res = await withRetry(() =>
    anthropic().messages.create({
      model: opts.model ?? env.anthropicModel,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.3,
      system: opts.system,
      messages: [
        { role: 'user', content: opts.user },
        ...(opts.prefill ? [{ role: 'assistant' as const, content: opts.prefill }] : []),
      ],
    }),
  );
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return opts.prefill ? opts.prefill + text : text;
}

/**
 * Structured output. The model is prefilled with `{` and the response is
 * repaired before parsing, because a truncated or fenced reply is the single
 * most common failure and it should never surface to the user.
 */
export async function askJson<T>(opts: AskOptions & { fallback: T }): Promise<T> {
  try {
    const raw = await askText({ ...opts, prefill: opts.prefill ?? '{', temperature: opts.temperature ?? 0 });
    return parseJson<T>(raw, opts.fallback);
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
