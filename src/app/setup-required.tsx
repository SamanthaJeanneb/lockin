import { features } from '@/lib/env';

/**
 * The screen you see before any keys are filled in. It is deliberately part of
 * the product rather than a crash: you can run `npm run dev` on a fresh clone
 * and the app tells you exactly what it wants.
 */
export function SetupRequired({ missing }: { missing: string[] }) {
  const optional: [string, boolean, string][] = [
    ['ANTHROPIC_API_KEY', features.ai, 'Extraction, matching, breakdowns, rewriting'],
    ['OPENAI_API_KEY', features.embeddings, 'Embeddings and voice transcription'],
    ['PLAID_CLIENT_ID / PLAID_SECRET', features.plaid, 'Bank, brokerage and loan connections'],
    ['GOOGLE_CLIENT_ID / SECRET', features.googleCalendar, 'Calendar sync and free-block scheduling'],
    ['TWILIO_*', features.sms, 'Capture and complete by text message'],
    ['RESEND_API_KEY', features.email, 'Digest email and the push fallback'],
    ['VAPID keys', features.push, 'Browser notifications'],
    ['INNGEST_EVENT_KEY', features.jobs, 'Durable background jobs (runs inline without it)'],
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-measure flex-col justify-center gap-xl p-2xl">
      <div>
        <h1 className="t-display">LockIn</h1>
        <p className="t-body mt-sm text-ink-muted">
          Almost there. The app needs a database and an auth provider before it can render anything.
        </p>
      </div>

      <section>
        <h2 className="t-heading-sm">Required, and currently missing</h2>
        <div className="mt-sm">
          {missing.map((m) => (
            <div key={m} className="flex items-baseline gap-md border-b border-hairline py-sm">
              <code className="t-mono w-[280px] shrink-0">{m}</code>
              <span className="t-body-sm text-ink-subtle">not set</span>
            </div>
          ))}
        </div>
        <p className="t-body-sm mt-md text-ink-muted">
          Copy <code className="t-mono">.env.example</code> to <code className="t-mono">.env.local</code>,
          fill these in, and reload. <code className="t-mono">SETUP.md</code> has the click-by-click version.
        </p>
      </section>

      <section>
        <h2 className="t-heading-sm">Optional, feature by feature</h2>
        <p className="t-body-sm mt-xs text-ink-subtle">
          Everything below degrades cleanly. The app runs without any of it.
        </p>
        <div className="mt-sm">
          {optional.map(([name, on, what]) => (
            <div key={name} className="flex items-baseline gap-md border-b border-hairline py-sm">
              <code className="t-mono w-[240px] shrink-0">{name}</code>
              <span className="t-body-sm w-[52px] shrink-0 text-ink-subtle">{on ? 'on' : 'off'}</span>
              <span className="t-body-sm text-ink-muted">{what}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
