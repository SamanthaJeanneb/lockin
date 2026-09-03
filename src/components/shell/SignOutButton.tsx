'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from '@/components/ui';

/**
 * Signs out of the browser session, then posts to the route handler that
 * expires the cookies the middleware refreshes. A real form post, so the
 * browser follows the redirect and every Server Component is rebuilt without
 * the session — a client-side navigation would leave stale ones behind.
 */
export function SignOutButton({
  label = 'Sign out',
  className,
  variant,
}: {
  label?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  const [busy, setBusy] = useState(false);

  return (
    <form
      action="/auth/signout"
      method="post"
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        const form = e.currentTarget;
        void supabaseBrowser()
          .auth.signOut()
          .catch(() => {
            // The route handler clears the cookies either way.
          })
          .finally(() => form.submit());
      }}
    >
      <Button type="submit" variant={variant} className={className} disabled={busy}>
        {busy ? 'Signing out…' : label}
      </Button>
    </form>
  );
}
