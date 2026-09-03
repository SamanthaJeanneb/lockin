import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Refreshes the Supabase session on every navigation so a Server Component
 *  never sees an expired token. */
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

  await supabase.auth.getUser();
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
