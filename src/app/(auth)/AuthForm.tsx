'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button, Input, Meta } from '@/components/ui';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice('Check your inbox to confirm the address, then sign in.');
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: 'google' | 'github') {
    const supabase = supabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-lg">
      <div>
        <h1 className="t-title">Life OS</h1>
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
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />
      </div>

      {error ? (
        <p className="t-caption rounded-md border border-hairline-focus p-sm text-ink">{error}</p>
      ) : null}
      {notice ? <Meta>{notice}</Meta> : null}

      <Button type="submit" variant="primary" size="lg" disabled={busy}>
        {mode === 'signup' ? 'Create account' : 'Sign in'}
      </Button>

      <div className="flex items-center gap-sm">
        <span className="h-px flex-1 bg-hairline" />
        <Meta>or</Meta>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <div className="flex gap-sm">
        <Button type="button" variant="secondary" className="flex-1" onClick={() => void oauth('google')}>
          Google
        </Button>
        <Button type="button" variant="secondary" className="flex-1" onClick={() => void oauth('github')}>
          GitHub
        </Button>
      </div>

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
