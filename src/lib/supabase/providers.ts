import { env } from '@/lib/env';

export type OAuthProvider = 'google' | 'github';

const CANDIDATES: OAuthProvider[] = ['google', 'github'];

/**
 * Which sign-in methods the Supabase project actually has turned on.
 *
 * Rendering a "Continue with Google" button for a provider that is disabled
 * sends people to a Supabase error page, so the login screen asks the project
 * what it supports rather than assuming. Failure is treated as "email only":
 * the password form always works, so a settings fetch that times out must not
 * take the whole page down with it.
 */
export async function getAuthProviders(): Promise<{ email: boolean; oauth: OAuthProvider[] }> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return { email: true, oauth: [] };
  try {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: env.supabaseAnonKey },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { email: true, oauth: [] };
    const json = (await res.json()) as { external?: Record<string, boolean> };
    const external = json.external ?? {};
    return {
      email: external.email !== false,
      oauth: CANDIDATES.filter((p) => external[p] === true),
    };
  } catch {
    return { email: true, oauth: [] };
  }
}
