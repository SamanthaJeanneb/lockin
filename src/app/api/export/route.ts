import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  account, activity, appUser, edge, lifeArea, metric, modelFact, object, review, transaction,
  userSettings,
} from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError } from '@/lib/api';
import { format } from 'date-fns';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Full export. Your data leaves in a form you can read without this app. */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const shape = new URL(req.url).searchParams.get('format') ?? 'json';

    const [objects, edges, activities, metrics, facts, accounts, transactions, reviews, areas, settings] =
      await Promise.all([
        db.select().from(object).where(and(eq(object.userId, user.id), isNull(object.deletedAt))),
        db.select().from(edge).where(eq(edge.userId, user.id)),
        db.select().from(activity).where(eq(activity.userId, user.id)),
        db.select().from(metric).where(eq(metric.userId, user.id)),
        db.select().from(modelFact).where(eq(modelFact.userId, user.id)),
        db.select().from(account).where(eq(account.userId, user.id)),
        db.select().from(transaction).where(eq(transaction.userId, user.id)),
        db.select().from(review).where(eq(review.userId, user.id)),
        db.select().from(lifeArea).where(eq(lifeArea.userId, user.id)),
        db.select().from(userSettings).where(eq(userSettings.userId, user.id)),
      ]);

    const stamp = format(new Date(), 'yyyy-MM-dd');

    if (shape === 'markdown') {
      const byType = new Map<string, typeof objects>();
      for (const o of objects) (byType.get(o.type) ?? byType.set(o.type, []).get(o.type)!).push(o);

      const md = [
        `# Life OS export — ${stamp}`,
        '',
        user.identityStatement ? `> ${user.identityStatement}` : '',
        '',
        ...[...byType.entries()]
          .sort()
          .flatMap(([type, items]) => [
            `## ${type} (${items.length})`,
            '',
            ...items.map((o) => {
              const bits = [
                o.completedAt ? '- [x]' : '- [ ]',
                o.title,
                o.area ? `· ${o.area}` : '',
                o.dueAt ? `· due ${format(o.dueAt, 'yyyy-MM-dd')}` : '',
                Number(o.progress) ? `· ${Math.round(Number(o.progress))}%` : '',
              ].filter(Boolean);
              return bits.join(' ') + (o.body ? `\n\n  ${o.body.replace(/\n/g, '\n  ')}\n` : '');
            }),
            '',
          ]),
      ].join('\n');

      return new Response(md, {
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'content-disposition': `attachment; filename="life-os-${stamp}.md"`,
        },
      });
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      user: { email: user.email, name: user.name, timezone: user.timezone, identityStatement: user.identityStatement },
      settings: settings[0] ?? null,
      areas,
      objects,
      edges,
      activity: activities,
      metrics,
      modelFacts: facts,
      accounts,
      transactions,
      reviews,
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="life-os-${stamp}.json"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
