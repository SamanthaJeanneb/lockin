import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { getUser, getSettings } from '@/lib/auth';
import { DEFAULT_UI } from '@/lib/store';
import { Suspense } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { SetupRequired } from '../setup-required';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const missing = [
    !env.databaseUrl && 'DATABASE_URL',
    !env.devUser && !env.supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
    !env.devUser && !env.supabaseAnonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ].filter(Boolean) as string[];

  if (missing.length) return <SetupRequired missing={missing} />;

  let user = null;
  let settings = null;
  try {
    user = await getUser();
    if (user) settings = await getSettings(user.id);
  } catch (e) {
    return (
      <SetupRequired
        missing={[
          `DATABASE_URL — could not reach the database (${e instanceof Error ? e.message : 'unknown error'})`,
        ]}
      />
    );
  }

  if (!user) redirect('/login');

  return (
    <Suspense fallback={null}>
      <AppShell initialUi={settings?.ui ?? DEFAULT_UI}>{children}</AppShell>
    </Suspense>
  );
}
