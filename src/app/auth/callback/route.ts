import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { provision } from '@/lib/auth';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await provision(
        data.user.id,
        data.user.email ?? '',
        (data.user.user_metadata?.name as string) ?? null,
      );
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL('/login?error=auth', url.origin));
}
