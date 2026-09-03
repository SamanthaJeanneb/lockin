import { cache } from 'react';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { appUser, lifeArea, userSettings } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_AREAS } from '@/lib/constants';
import { env } from '@/lib/env';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
  identityStatement: string | null;
  onboardedAt: Date | null;
}

export class Unauthorized extends Error {
  constructor() {
    super('Not signed in');
    this.name = 'Unauthorized';
  }
}

/** Returns the signed-in user, provisioning their rows on first sight. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  // Development bypass: a fixed local account so the app is usable against a
  // local Postgres before any auth provider exists. Never active in production.
  if (env.devUser) {
    const id = devUserId(env.devUser);
    const existing = await db.select().from(appUser).where(eq(appUser.id, id)).limit(1);
    if (!existing.length) await provision(id, env.devUser, env.devUser.split('@')[0]!);
    const r =
      existing[0] ?? (await db.select().from(appUser).where(eq(appUser.id, id)).limit(1))[0]!;
    return {
      id: r.id, email: r.email, name: r.name, timezone: r.timezone,
      identityStatement: r.identityStatement, onboardedAt: r.onboardedAt,
    };
  }

  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const rows = await db.select().from(appUser).where(eq(appUser.id, user.id)).limit(1);
  if (rows.length) {
    const r = rows[0]!;
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      timezone: r.timezone,
      identityStatement: r.identityStatement,
      onboardedAt: r.onboardedAt,
    };
  }

  // The auth trigger normally does this. Doing it here too means a project
  // created without the trigger still works.
  await provision(user.id, user.email ?? '', (user.user_metadata?.name as string) ?? null);
  return {
    id: user.id,
    email: user.email ?? '',
    name: (user.user_metadata?.name as string) ?? null,
    timezone: 'UTC',
    identityStatement: null,
    onboardedAt: null,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new Unauthorized();
  return user;
}

export async function provision(id: string, email: string, name: string | null) {
  await db
    .insert(appUser)
    .values({ id, email, name: name ?? email.split('@')[0]! })
    .onConflictDoNothing();
  await db
    .insert(userSettings)
    .values({
      userId: id,
      ui: {
        sidebar_collapsed: false,
        context_pane_width: 360,
        density: 'comfortable',
        theme: 'system',
        goal_tree_expanded: [],
        last_board_lens: 'all',
        table_sorts: {},
        shortcuts_seen: false,
      },
      notify: {
        channels: ['webpush', 'email'],
        morning: '07:30',
        afternoon: '13:00',
        evening: '21:00',
        proactive_per_day: 1,
      },
      ai: { permission: 'suggest', capabilities: {}, voice_samples: [], finance_in_prompts: false },
      privacy: { journal_in_prompts: true, share_annual: false },
      areaPriority: ['career', 'finance', 'health', 'relationships', 'learning'],
    })
    .onConflictDoNothing();
  await db
    .insert(lifeArea)
    .values(
      DEFAULT_AREAS.map((key, i) => ({
        userId: id,
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        series: i + 1,
        position: i,
        priority: i + 1,
      })),
    )
    .onConflictDoNothing();
}

export const getSettings = cache(async (userId: string) => {
  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return rows[0] ?? null;
});

export const getAreas = cache(async (userId: string) => {
  return db.select().from(lifeArea).where(eq(lifeArea.userId, userId)).orderBy(lifeArea.position);
});


/** Stable uuid v5-ish id derived from the dev email, so restarts keep the data. */
export function devUserId(email: string): string {
  const hash = createHash('sha256').update(`lifeos-dev:${email}`).digest('hex');
  return [
    hash.slice(0, 8), hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    ((parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}
