'use client';
import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';

let client: ReturnType<typeof createBrowserClient> | undefined;

export function supabaseBrowser() {
  // These reach the browser only because `env` spells them out statically for
  // Next to inline. If that ever regresses, the client is built against
  // undefined and every auth call hangs — so say so instead.
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured in the browser bundle. NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY must be set at build time, not only at runtime.',
    );
  }
  client ??= createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}
