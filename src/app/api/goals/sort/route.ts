import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { handleError, ok, parseBody, rateLimit, tooMany } from '@/lib/api';
import { askJsonSafe } from '@/lib/ai/client';
import { GOAL_SORT_SYSTEM } from '@/lib/ai/prompts';
import { GOAL_SORT_SCHEMA } from '@/lib/ai/schemas';
import { promptContext } from '@/lib/ai/context';
import { features } from '@/lib/env';
import { DEFAULT_AREAS, HORIZONS, type Horizon } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Body = z.object({
  entries: z
    .array(
      z.object({
        horizon: z.enum(HORIZONS),
        text: z.string().max(4000),
      }),
    )
    .max(HORIZONS.length),
});

export interface SortedGoal {
  horizon: Horizon;
  title: string;
  area: string;
  metric: string | null;
}

/**
 * Turns what someone wrote at each time horizon into goals they can edit.
 *
 * Nothing is written here. The reply is a proposal the person confirms, which
 * is the only honest way to let a model reword what someone said about their
 * own life.
 *
 * Horizons are run in parallel and kept separate: the horizon is the user's
 * decision, made by which box they typed in, and is never the model's to move.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!rateLimit(`goalsort:${user.id}`, 20)) return tooMany();
    const b = await parseBody(req, Body);

    const filled = b.entries.filter((e) => e.text.trim());
    if (!filled.length) return ok({ goals: [] as SortedGoal[], sorted: false });

    // Without a model the lines are still theirs — one goal per line, in the
    // horizon they chose. Worse, but never worse than losing what they typed.
    if (!features.ai) {
      return ok({ goals: filled.flatMap((e) => splitLines(e.text).map(bare(e.horizon))), sorted: false });
    }

    const ctx = await promptContext(user.id, {
      identity: user.identityStatement,
      timezone: user.timezone,
      withOpenItems: false,
    });

    const results = await Promise.all(
      filled.map(async (entry) => {
        const { goals } = await askJsonSafe<{ goals: { title: string; area: string; metric: string | null }[] }>({
          system: GOAL_SORT_SYSTEM(ctx),
          user: `Horizon: ${entry.horizon}\n\n${entry.text.trim()}`,
          maxTokens: 2000,
          schema: GOAL_SORT_SCHEMA as unknown as Record<string, unknown>,
          fallback: { goals: [] },
        });

        // A model that returned nothing must not silently eat what they wrote.
        if (!goals.length) return splitLines(entry.text).map(bare(entry.horizon));

        return goals
          .filter((g) => g.title?.trim())
          .map((g) => ({
            horizon: entry.horizon,
            title: g.title.trim().slice(0, 500),
            area: knownArea(g.area, ctx.areas.map((a) => a.key)),
            metric: g.metric?.trim() || null,
          }));
      }),
    );

    return ok({ goals: results.flat(), sorted: true });
  } catch (e) {
    return handleError(e);
  }
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n|(?<=[.!?])\s{2,}/)
    .map((l) => l.replace(/^\s*[-•*\d.)\]]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 20);
}

const bare = (horizon: Horizon) => (title: string): SortedGoal => ({
  horizon,
  title: title.slice(0, 500),
  area: DEFAULT_AREAS[0]!,
  metric: null,
});

/** A model naming an area the user does not have is a miss, not a new area. */
function knownArea(area: string | undefined, available: string[]): string {
  const a = area?.trim().toLowerCase();
  if (a && available.includes(a)) return a;
  return available[0] ?? DEFAULT_AREAS[0]!;
}
