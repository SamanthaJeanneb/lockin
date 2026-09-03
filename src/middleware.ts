import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Everything reachable without a session: the auth screens themselves, the
 *  OAuth callback, and the public read-only share pages. API routes check
 *  their own caller and answer 401 rather than redirecting. */
const PUBLIC = [/^\/login/, /^\/signup/, /^\/auth\//, /^\/api\//, /^\/r\//, /^\/share/];

/** Refreshes the Supabase session on every navigation so a Server Component
 *  never sees an expired token, and turns anonymous visitors away at the edge
 *  instead of letting a protected page render and redirect. */
export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC.some((r) => r.test(path));

  // The local sign-in bypass has no Supabase session by design, so the guard
  // has to stand down for it. `LOCKIN_DEV_USER` is ignored in production.
  const devBypass = process.env.NODE_ENV !== 'production' && Boolean(process.env.LOCKIN_DEV_USER);

  if (!user && !isPublic && !devBypass) {
    const to = req.nextUrl.clone();
    to.pathname = '/login';
    to.search = '';
    // Come back to where they were headed once they are signed in.
    if (path !== '/') to.searchParams.set('next', path + req.nextUrl.search);
    return NextResponse.redirect(to);
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
