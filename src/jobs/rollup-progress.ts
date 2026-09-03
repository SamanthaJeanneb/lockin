import { db } from '@/lib/db/client';
import { appUser } from '@/lib/db/schema';
import { rollupProgress } from '@/lib/db/rollup';

export async function rollupProgressJob({ userId }: { userId?: string } = {}) {
  const users = userId
    ? [{ id: userId }]
    : await db.select({ id: appUser.id }).from(appUser);
  let updated = 0;
  for (const u of users) updated += await rollupProgress(u.id);
  return { users: users.length, updated };
}
