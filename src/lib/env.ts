/**
 * Environment access in one place. Nothing throws at import time — the app
 * boots with only Supabase configured and degrades feature by feature, which
 * is what makes `npm run dev` work before every key is filled in.
 */
function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export const env = {
  // Required for anything to work
  supabaseUrl: opt('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: opt('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
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
  vapidPublic: opt('NEXT_PUBLIC_VAPID_PUBLIC_KEY'),
  vapidPrivate: opt('VAPID_PRIVATE_KEY'),
  vapidSubject: opt('VAPID_SUBJECT') ?? 'mailto:hello@example.com',

  // Jobs
  inngestEventKey: opt('INNGEST_EVENT_KEY'),
  inngestSigningKey: opt('INNGEST_SIGNING_KEY'),
  cronSecret: opt('CRON_SECRET'),

  // Crypto
  encryptionKey: opt('ENCRYPTION_KEY'),

  appUrl: opt('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000',

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
