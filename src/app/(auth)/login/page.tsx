import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { getUser } from '@/lib/auth';
import { getAuthProviders } from '@/lib/supabase/providers';
import { SetupRequired } from '../../setup-required';
import { AuthForm } from '../AuthForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const missing = [
    !env.supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
    !env.supabaseAnonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    !env.databaseUrl && 'DATABASE_URL',
  ].filter(Boolean) as string[];
  if (missing.length) return <SetupRequired missing={missing} />;

  // Someone who is already signed in has no business on this page.
  if (await getUser().catch(() => null)) redirect('/');

  const { oauth } = await getAuthProviders();
  return <AuthForm mode="login" providers={oauth} />;
}
