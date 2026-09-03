import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

/**
 * Server-side sign out. The browser client can clear its own cookies, but only
 * a Route Handler can expire the ones the middleware refreshed, so this is the
 * authoritative path — the button posts here and follows the redirect.
 */
async function signOut(req: Request) {
  const origin = new URL(req.url).origin;
  if (env.supabaseUrl && env.supabaseAnonKey) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL('/login', origin), { status: 303 });
}

export const POST = signOut;
export const GET = signOut;
