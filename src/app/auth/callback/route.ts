import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { provision } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Where an OAuth or email-link sign-in lands. Exchanges the code for a
 *  session cookie, makes sure the account's rows exist, then forwards on. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  // Only ever redirect within this site: `next` arrives from a query string,
  // so an absolute URL there would be an open redirect out of the app.
  const raw = url.searchParams.get('next') ?? '/';
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';

  // Supabase reports provider-side failures on the query string, not as a code.
  const providerError = url.searchParams.get('error_description') ?? url.searchParams.get('error');

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // The auth trigger normally provisions; doing it here too means a project
      // created without the trigger still ends up with a usable account.
      try {
        await provision(
          data.user.id,
          data.user.email ?? '',
          (data.user.user_metadata?.name as string) ?? null,
        );
      } catch {
        // The session is valid either way — the app layout provisions on first
        // page load if this failed.
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  const reason = providerError ? 'auth' : code ? 'expired' : 'auth';
  return NextResponse.redirect(new URL(`/login?error=${reason}`, url.origin));
}
