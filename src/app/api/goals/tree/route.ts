import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { requireUser } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';
import { progressDeltas } from '@/lib/db/rollup';

export const dynamic = 'force-dynamic';

interface Row {
  id: string; parent_id: string | null; depth: number; title: string;
  area: string | null; horizon: string | null; progress: string;
  due_at: string | null; status: string | null; trajectory: string; delta7: string;
}

export interface GoalNode {
  id: string; parentId: string | null; depth: number; title: string;
  area: string | null; horizon: string | null; progress: number;
  dueAt: string | null; status: string | null; trajectory: string; delta7: number;
  children: GoalNode[];
}

/** Recursive CTE returning the hierarchy with rolled-up progress and trajectory. */
export async function GET() {
  try {
    const user = await requireUser();
    const rows = (await db.execute(
      sql`select * from goal_tree(${user.id}::uuid)`,
    )) as unknown as Row[];

    const deltas = await progressDeltas(user.id, rows.map((r) => r.id));

    const byId = new Map<string, GoalNode>();
    for (const r of rows) {
      byId.set(r.id, {
        id: r.id,
        parentId: r.parent_id,
        depth: r.depth,
        title: r.title,
        area: r.area,
        horizon: r.horizon,
        progress: Number(r.progress),
        dueAt: r.due_at,
        status: r.status,
        trajectory: r.trajectory,
        delta7: Math.round(deltas.get(r.id) ?? Number(r.delta7 ?? 0)),
        children: [],
      });
    }

    const roots: GoalNode[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node);
      else roots.push(node);
    }

    // Group the top level by life area, which is how the tree actually reads.
    const areas = new Map<string, GoalNode[]>();
    for (const r of roots) {
      const key = r.area ?? 'unlinked';
      (areas.get(key) ?? areas.set(key, []).get(key)!).push(r);
    }

    return ok({
      roots,
      areas: [...areas.entries()].map(([area, goals]) => ({
        area,
        goals,
        progress: Math.round(goals.reduce((a, g) => a + g.progress, 0) / (goals.length || 1)),
        delta7: Math.round(goals.reduce((a, g) => a + g.delta7, 0) / (goals.length || 1)),
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
