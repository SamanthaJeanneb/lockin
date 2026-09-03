import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component; the middleware refreshes the session instead.
        }
      },
    },
  });
}

/** Service-role client. Server only, never sent to the browser. */
export function createAdminClient() {
  const { createClient: create } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
  return create(env.supabaseUrl!, env.supabaseServiceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
