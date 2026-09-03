import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { appUser, integration, lifeArea, userSettings } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError, ok, parseBody } from '@/lib/api';
import { features } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, user.id));
    const areas = await db.select().from(lifeArea).where(eq(lifeArea.userId, user.id)).orderBy(lifeArea.position);
    const integrations = await db
      .select({
        id: integration.id, kind: integration.kind, status: integration.status,
        lastSyncAt: integration.lastSyncAt, error: integration.error, meta: integration.meta,
      })
      .from(integration)
      .where(eq(integration.userId, user.id));

    return ok({
      user: {
        id: user.id, email: user.email, name: user.name, timezone: user.timezone,
        identityStatement: user.identityStatement, onboardedAt: user.onboardedAt,
      },
      settings,
      areas,
      integrations,
      available: {
        ai: features.ai, embeddings: features.embeddings, plaid: features.plaid,
        googleCalendar: features.googleCalendar, sms: features.sms, email: features.email,
        push: features.push, jobs: features.jobs, voice: features.voice,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

const Body = z.object({
  name: z.string().optional(),
  timezone: z.string().optional(),
  identityStatement: z.string().nullish(),
  onboarded: z.boolean().optional(),
  notify: z.record(z.string(), z.unknown()).optional(),
  ai: z.record(z.string(), z.unknown()).optional(),
  privacy: z.record(z.string(), z.unknown()).optional(),
  areaPriority: z.array(z.string()).optional(),
});

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const b = await parseBody(req, Body);

    if (b.name || b.timezone || b.identityStatement !== undefined || b.onboarded) {
      await db
        .update(appUser)
        .set({
          ...(b.name ? { name: b.name } : {}),
          ...(b.timezone ? { timezone: b.timezone } : {}),
          ...(b.identityStatement !== undefined ? { identityStatement: b.identityStatement } : {}),
          ...(b.onboarded ? { onboardedAt: new Date() } : {}),
        })
        .where(eq(appUser.id, user.id));
    }

    if (b.notify || b.ai || b.privacy || b.areaPriority) {
      await db
        .update(userSettings)
        .set({
          ...(b.notify ? { notify: b.notify } : {}),
          ...(b.ai ? { ai: b.ai } : {}),
          ...(b.privacy ? { privacy: b.privacy } : {}),
          ...(b.areaPriority ? { areaPriority: b.areaPriority } : {}),
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, user.id));
    }

    return ok({ saved: true });
  } catch (e) {
    return handleError(e);
  }
}
