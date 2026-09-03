/**
 * Environment access in one place. Nothing throws at import time — the app
 * boots with only Supabase configured and degrades feature by feature, which
 * is what makes `npm run dev` work before every key is filled in.
 */
function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

/**
 * The same thing as `opt`, for values the browser needs.
 *
 * Next replaces `process.env.NEXT_PUBLIC_X` in client code at build time, but
 * only where it is written out literally — a computed `process.env[name]`
 * lookup is left alone, and in the browser it reads as undefined. So every
 * public variable is spelled out here, in full, on purpose. Shortening these
 * into `opt('NEXT_PUBLIC_...')` silently breaks sign-in.
 */
function pub(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  // Required for anything to work
  supabaseUrl: pub(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: pub(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  supabaseServiceKey: opt('SUPABASE_SERVICE_ROLE_KEY'),
  databaseUrl: opt('DATABASE_URL'),

  // Intelligence
  anthropicKey: opt('ANTHROPIC_API_KEY'),
  anthropicModel: opt('ANTHROPIC_MODEL') ?? 'claude-sonnet-5',
  openaiKey: opt('OPENAI_API_KEY'),
  embeddingModel: opt('EMBEDDING_MODEL') ?? 'text-embedding-3-small',

  // Money
  plaidClientId: opt('PLAID_CLIENT_ID'),
  plaidSecret: opt('PLAID_SECRET'),
  plaidEnv: opt('PLAID_ENV') ?? 'sandbox',

  // Calendar and mail
  googleClientId: opt('GOOGLE_CLIENT_ID'),
  googleClientSecret: opt('GOOGLE_CLIENT_SECRET'),
  microsoftClientId: opt('MICROSOFT_CLIENT_ID'),
  microsoftClientSecret: opt('MICROSOFT_CLIENT_SECRET'),

  // Messaging
  twilioSid: opt('TWILIO_ACCOUNT_SID'),
  twilioToken: opt('TWILIO_AUTH_TOKEN'),
  twilioPhone: opt('TWILIO_PHONE_NUMBER'),
  resendKey: opt('RESEND_API_KEY'),
  emailFrom: opt('EMAIL_FROM') ?? 'LockIn <onboarding@resend.dev>',

  // Push
  vapidPublic: pub(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
  vapidPrivate: opt('VAPID_PRIVATE_KEY'),
  vapidSubject: opt('VAPID_SUBJECT') ?? 'mailto:hello@example.com',

  // Jobs
  inngestEventKey: opt('INNGEST_EVENT_KEY'),
  inngestSigningKey: opt('INNGEST_SIGNING_KEY'),
  /** Set when running `npm run inngest` — the local dev server can reach
   *  localhost, where Inngest Cloud cannot. */
  inngestDev: opt('INNGEST_DEV') === 'true',
  cronSecret: opt('CRON_SECRET'),

  // Crypto
  encryptionKey: opt('ENCRYPTION_KEY'),

  appUrl: pub(process.env.NEXT_PUBLIC_APP_URL) ?? 'http://localhost:3000',

  /**
   * Development-only sign-in bypass. When set, requests are treated as coming
   * from this account so the whole app can be exercised against a local
   * Postgres with no auth provider configured. Ignored in production, always.
   */
  devUser: process.env.NODE_ENV === 'production' ? undefined : opt('LOCKIN_DEV_USER'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
} as const;

export const features = {
  get ai() {
    return Boolean(env.anthropicKey);
  },
  get embeddings() {
    return Boolean(env.openaiKey);
  },
  get voice() {
    return Boolean(env.openaiKey);
  },
  get plaid() {
    return Boolean(env.plaidClientId && env.plaidSecret);
  },
  get googleCalendar() {
    return Boolean(env.googleClientId && env.googleClientSecret);
  },
  get sms() {
    return Boolean(env.twilioSid && env.twilioToken && env.twilioPhone);
  },
  get email() {
    return Boolean(env.resendKey);
  },
  get push() {
    return Boolean(env.vapidPublic && env.vapidPrivate);
  },
  get jobs() {
    return Boolean(env.inngestEventKey);
  },
  /**
   * Whether Inngest can actually run our functions.
   *
   * Inngest is a callback service: it receives an event, then calls back into
   * `/api/inngest` to execute. It cannot reach `http://localhost:3000`, so a
   * configured key on a local URL means events queue in the cloud and nothing
   * ever runs. Having the key is not the same as being able to use it.
   */
  get jobsReachable() {
    if (!env.inngestEventKey) return false;
    if (env.inngestDev) return true;
    return !/localhost|127\.0\.0\.1|0\.0\.0\.0|\.local(:|$)/.test(env.appUrl);
  },
};

export function requireEnv(name: keyof typeof env): string {
  const v = env[name];
  if (!v || typeof v !== 'string') {
    throw new Error(
      `${name} is not configured. See SETUP.md — the feature that needs it is disabled until it is.`,
    );
  }
  return v;
}
