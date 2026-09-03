import { env } from '@/lib/env';
import { SetupRequired } from '../../setup-required';
import { AuthForm } from '../AuthForm';

export const dynamic = 'force-dynamic';

export default function SignupPage() {
  const missing = [
    !env.supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
    !env.supabaseAnonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    !env.databaseUrl && 'DATABASE_URL',
  ].filter(Boolean) as string[];
  if (missing.length) return <SetupRequired missing={missing} />;
  return <AuthForm mode="signup" />;
}
