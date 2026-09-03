'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import type { OAuthProvider } from '@/lib/supabase/providers';
import { Button, Input, Meta } from '@/components/ui';

const PROVIDER_LABEL: Record<OAuthProvider, string> = { google: 'Google', github: 'GitHub' };

const CALLBACK_ERRORS: Record<string, string> = {
  auth: 'That sign-in link did not work. Try again.',
  expired: 'That link has expired. Sign in again to get a new one.',
};

export function AuthForm({
  mode,
  providers = [],
}: {
  mode: 'login' | 'signup';
  providers?: OAuthProvider[];
}) {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(
    CALLBACK_ERRORS[params.get('error') ?? ''] ?? null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  /** Where to land after signing in. Relative paths only — a `next` of
   *  `https://elsewhere` would otherwise walk the user straight off the site. */
  const next = (() => {
    const raw = params.get('next');
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
  })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = supabaseBrowser();
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: name.trim() || null },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        // A project with email confirmation on returns a user but no session.
        if (!data.session) {
          setNotice(`Check ${email} to confirm the address, then sign in.`);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      // A full navigation, not router.push: the Server Components above this
      // form have to be rebuilt against the session cookie that just landed.
      window.location.assign(next);
    } catch (err) {
      setError(messageFor(err, mode));
      setBusy(false);
    }
  }

  async function oauth(provider: OAuthProvider) {
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-lg">
      <div>
        <h1 className="t-title">LockIn</h1>
        <Meta className="mt-xxs block">
          {mode === 'signup' ? 'One field to capture everything.' : 'Welcome back.'}
        </Meta>
      </div>

      <div className="flex flex-col gap-sm">
        {mode === 'signup' ? (
          <Input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        ) : null}
        <Input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <Input
          type="password"
          required
          minLength={8}
          placeholder={mode === 'signup' ? 'Password — at least 8 characters' : 'Password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />
      </div>

      {error ? (
        <p role="alert" className="t-caption rounded-md border border-hairline-focus p-sm text-ink">
          {error}
        </p>
      ) : null}
      {notice ? <Meta>{notice}</Meta> : null}

      <Button type="submit" variant="primary" size="lg" disabled={busy}>
        {busy
          ? mode === 'signup'
            ? 'Creating account…'
            : 'Signing in…'
          : mode === 'signup'
            ? 'Create account'
            : 'Sign in'}
      </Button>

      {providers.length ? (
        <>
          <div className="flex items-center gap-sm">
            <span className="h-px flex-1 bg-hairline" />
            <Meta>or</Meta>
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <div className="flex gap-sm">
            {providers.map((p) => (
              <Button
                key={p}
                type="button"
                variant="secondary"
                className="flex-1"
                disabled={busy}
                onClick={() => void oauth(p)}
              >
                {PROVIDER_LABEL[p]}
              </Button>
            ))}
          </div>
        </>
      ) : null}

      <Meta>
        {mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <Link href="/login" className="text-ink">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account yet?{' '}
            <Link href="/signup" className="text-ink">
              Create one
            </Link>
          </>
        )}
      </Meta>
    </form>
  );
}

/** Supabase speaks in API terms; these are the three cases people actually hit. */
function messageFor(err: unknown, mode: 'login' | 'signup'): string {
  const raw = err instanceof Error ? err.message : '';
  if (/invalid login credentials/i.test(raw)) return 'That email and password do not match an account.';
  if (/already registered|already been registered/i.test(raw))
    return 'There is already an account with that email. Sign in instead.';
  if (/email not confirmed/i.test(raw)) return 'Confirm your email address first, then sign in.';
  if (/rate limit|too many/i.test(raw)) return 'Too many attempts. Wait a minute and try again.';
  if (/fetch|network/i.test(raw)) return 'Could not reach the server. Check your connection.';
  return raw || (mode === 'signup' ? 'Could not create the account.' : 'Could not sign in.');
}
