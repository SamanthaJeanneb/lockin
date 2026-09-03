# LockIn — setup guide

Everything you need to click, in the order you need to click it.

The app is built to run before you have finished this document. Each section
adds one capability, and the app tells you in **Settings → Integrations** which
ones are live. Nothing here has to be done in one sitting.

**Contents**

1. [Run it locally in three minutes](#1-run-it-locally-in-three-minutes)
2. [The database and auth (Supabase)](#2-the-database-and-auth-supabase)
3. [Intelligence (Anthropic, OpenAI)](#3-intelligence-anthropic-openai)
4. [Money (Plaid)](#4-money-plaid)
5. [Calendar (Google)](#5-calendar-google)
6. [Messaging (Twilio, Resend)](#6-messaging-twilio-resend)
7. [Browser notifications (VAPID)](#7-browser-notifications-vapid)
8. [Background jobs (Inngest or Vercel Cron)](#8-background-jobs-inngest-or-vercel-cron)
9. [Deploying](#9-deploying)
10. [Verifying it all works](#10-verifying-it-all-works)
11. [Troubleshooting](#11-troubleshooting)
12. [The complete environment reference](#12-the-complete-environment-reference)

---

## 1. Run it locally in three minutes

You need **Node 20+** and **Docker Desktop** running.

```bash
npm install
npm run db:up        # Postgres 16 + pgvector on port 54322
npm run db:migrate   # applies supabase/migrations in order
npm run db:seed      # realistic demo data
npm run dev
```

Open <http://localhost:3000>.

`.env.local` already contains everything this needs:

```bash
DATABASE_URL=postgresql://lockin:lockin@localhost:54322/lockin
LOCKIN_DEV_USER=sam@example.com
```

### About `LOCKIN_DEV_USER`

This is a **development-only sign-in bypass**. When it is set, every request is
treated as coming from that account, so you can use the whole product before
configuring an auth provider.

It is ignored entirely when `NODE_ENV === 'production'` — see
`src/lib/env.ts`. Delete the line and fill in the Supabase keys (§2) to use real
authentication. There is no way to enable it in production, deliberately.

### What works with no API keys at all

- Capture — raw text is stored immediately and kept forever
- Debrief — matching on keyword overlap, completion-verb proximity and recency
- Today — ranked on deadlines, dependencies, status, priority and avoidance
- Goal tree, roadmap, drift, board, projects, backlog, waiting, brain, people,
  library, life, money, memory, reviews — every screen, fully interactive
- Progress rollup, milestone auto-advance, undo, keyboard shortcuts, dark mode

### What needs a key

Extraction into structured objects, semantic matching, project breakdown,
rewriting, what-if scenarios, bank sync, calendar sync, SMS, email and push.
Each has its own section below.

---

## 2. The database and auth (Supabase)

Local Docker is fine for development. Supabase is what you want for anything
real, because it brings auth and storage with it.

### 2.1 Create the project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Name it, choose a region near you, and set a database password.
   **Copy that password now** — it is shown once.
3. Wait for provisioning (about two minutes).

### 2.2 Enable the extensions

**Database → Extensions**, and enable:

| Extension | Why |
|---|---|
| `vector` | Semantic matching and duplicate detection |
| `pg_trgm` | Fuzzy title matching |
| `pgcrypto` | UUID generation |
| `btree_gin` | Composite indexes on the object table |

The migration also tries to create these, but enabling them in the dashboard
first avoids a permissions error on some plans.

### 2.3 Apply the schema

**SQL Editor → New query**, paste the entire contents of `schema.sql` from the
repo root, and run it.

That one file is migrations `0001` (core), `0002` (RLS and provisioning) and
`0003` (the 45-row object vocabulary), concatenated. It is idempotent — running
it twice is safe.

Alternatively, from your machine:

```bash
DATABASE_URL="<your connection string>" npm run db:migrate
```

You should see `Schema applied. 45 object types in the vocabulary.`

### 2.4 Copy the four values

**Project Settings → API**

| Dashboard field | `.env.local` |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` key | `SUPABASE_SERVICE_ROLE_KEY` |

**Project Settings → Database → Connection string → URI**, and pick
**Transaction pooler** (port `6543`). Replace `[YOUR-PASSWORD]` with the password
from step 2.1:

```bash
DATABASE_URL=postgresql://postgres.abcdefgh:YOURPASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

> **Use the pooler, not the direct connection.** Serverless functions open many
> short-lived connections and will exhaust the direct pool. The app already sets
> `prepare: false` because the transaction pooler does not support prepared
> statements.

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security. It is used only on
> the server, for file uploads. Never expose it to the browser and never prefix
> it with `NEXT_PUBLIC_`.

### 2.5 Turn on authentication

**Authentication → Providers → Email**: enable it. For local development also
turn **off** "Confirm email" so signup gives you a session immediately.

For Google or GitHub sign-in, enable the provider and add this redirect under
**Authentication → URL Configuration → Redirect URLs**:

```
http://localhost:3000/auth/callback
https://your-domain.com/auth/callback
```

Then remove `LOCKIN_DEV_USER` from `.env.local` and restart. `/login` now does
real authentication.

### 2.6 Create the storage bucket

**Storage → New bucket**, named exactly `attachments`, **not public**.

File uploads are disabled until this exists, and the app says so rather than
failing silently.

### 2.7 Verify isolation

Row-level security is on for every user table, and the app also filters by
`user_id` in code. To confirm both are working, create two accounts, add an
object to each, and check that neither sees the other's rows.

---

## 3. Intelligence (Anthropic, OpenAI)

### 3.1 Anthropic — the one that matters

This is what turns *"Met Alex at lunch, he's at OpenAI, he'll intro me to their
design lead, follow up Tuesday"* into a person, an interaction, a waiting-on, a
task and three edges between them.

1. <https://console.anthropic.com> → sign in.
2. **Settings → API keys → Create key**.
3. Copy it (shown once) into `.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-sonnet-5
```

**Add billing.** A new account has no credit and every call will fail with a
402. **Settings → Billing → Add payment method**, then buy credit.

**Cost.** Extraction is roughly 1–3k tokens in and under 1k out per capture. At
a dozen captures and one debrief a day, expect a few dollars a month.

Model choice: `claude-sonnet-5` is the right default. `claude-opus-5` gives
better extraction on ambiguous text for more money; `claude-haiku-4-5-20251001`
is cheaper and noticeably worse at edge inference. Set it with
`ANTHROPIC_MODEL`.

### 3.2 OpenAI — embeddings and voice

Two separate capabilities behind one key:

- **Embeddings** (`text-embedding-3-small`) raise debrief matching from keyword
  overlap to semantic similarity, and make duplicate detection work on
  *"Sarah Chen"* vs *"sarah"*.
- **Whisper** transcribes the voice button in Capture and Debrief.

```bash
OPENAI_API_KEY=sk-proj-...
EMBEDDING_MODEL=text-embedding-3-small
```

Embeddings are very cheap — pennies a month at personal scale.

Without this key, matching falls back to keyword overlap plus completion-verb
proximity, which works noticeably well. The voice button simply reports that
transcription is not configured.

---

## 4. Money (Plaid)

### 4.1 Get sandbox credentials

1. <https://dashboard.plaid.com/signup> → create an account.
2. **Team Settings → Keys**.
3. Copy `client_id` and the **Sandbox** secret:

```bash
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENV=sandbox
```

### 4.2 Add the Link script

Plaid Link runs in the browser. Add it to `src/app/layout.tsx`, inside `<head>`:

```tsx
<script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js" async />
```

The Content-Security-Policy in `next.config.ts` already allows
`https://cdn.plaid.com`.

### 4.3 Register the webhook

**Team Settings → Webhooks**:

```
https://your-domain.com/api/webhooks/plaid
```

Sandbox cannot reach `localhost`. For local testing, tunnel it:

```bash
npx ngrok http 3000
# then register https://<id>.ngrok-free.app/api/webhooks/plaid
```

### 4.4 Test it

**Money → Accounts → Connect a bank**. In sandbox use:

- Institution: **First Platypus Bank**
- Username: `user_good`
- Password: `pass_good`
- If asked for an MFA code: `1234`

Balances and roughly two years of transactions sync immediately, then get
categorised by rule first and by AI for whatever the rules miss.

### 4.5 Going live

Plaid requires a production application review before real bank connections.
When approved, set `PLAID_ENV=production` and swap in the production secret.

Until then, manual accounts and expenses captured in a sentence
(*"spent about $60 on dinner"*) work with no Plaid at all.

---

## 5. Calendar (Google)

The calendar drives Today's *"45 minutes free — the homepage fits"*, the
roadmap's load shading, and scheduling write-back.

1. <https://console.cloud.google.com> → create a project.
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **OAuth consent screen** → External → fill in the app name and your email.
   Add these scopes:
   - `.../auth/calendar.readonly`
   - `.../auth/calendar.events`
   While the app is in Testing, add your own address under **Test users** or
   OAuth will refuse you.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   Authorised redirect URIs:

```
http://localhost:3000/api/integrations/google/callback
https://your-domain.com/api/integrations/google/callback
```

5. Copy the values:

```bash
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

Connect from **Settings → Integrations → Google Calendar**. It syncs a window of
−30/+90 days on first connect and incrementally thereafter, every thirty minutes.

**Microsoft / Outlook:** set `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`
from an Azure app registration with `Calendars.ReadWrite`. **Apple:** CalDAV with
an app-specific password from <https://appleid.apple.com>.

---

## 6. Messaging (Twilio, Resend)

### 6.1 Twilio — capture by text

Texting your LockIn number runs the same pipeline as `⌘K` and replies with a
summary. This is the whole interface when you are away from a desk.

1. <https://console.twilio.com> → sign up (trial credit is enough).
2. **Phone Numbers → Buy a number** with SMS capability.
3. From the console dashboard:

```bash
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+15551234567
```

4. On the number's configuration page, set **A message comes in** to
   **Webhook**, `POST`:

```
https://your-domain.com/api/webhooks/twilio
```

5. Link your own phone: **Settings → Notifications**, add your number in E.164
   form (`+15559876543`). This is how an inbound text is matched to your account.

Inbound requests are verified against Twilio's signature. Unsigned requests are
rejected with a 403.

> Trial accounts can only text numbers you have verified in the console.

### 6.2 Resend — email

Digest email, and the documented fallback whenever a browser has no live push
subscription (which is most of iOS Safari).

1. <https://resend.com/signup>.
2. **API Keys → Create**.
3. **Domains → Add domain**, then add the DKIM and SPF records it gives you.

```bash
RESEND_API_KEY=re_...
EMAIL_FROM="LockIn <hello@your-domain.com>"
```

Without a verified domain you can still send from `onboarding@resend.dev` to
your own address, which is enough to test.

---

## 7. Browser notifications (VAPID)

Web Push works on desktop Chrome, Edge, Firefox and Safari, and on Android.
On iOS it only works for a PWA added to the home screen, and inconsistently —
which is exactly why email is a designed-in fallback rather than an afterthought.

Generate a key pair:

```bash
npx web-push generate-vapid-keys
```

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BN...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@your-domain.com
```

Subscribe from **Settings → Integrations → Push → Enable**. Push is per-browser,
so Chrome on your desktop and the installed PWA on your phone each need their
own subscription — that is expected, and both are listed in Settings.

> The public key is deliberately `NEXT_PUBLIC_` — the browser needs it to
> subscribe. The private key must never be.

---

## 8. Background jobs (Inngest or Vercel Cron)

Extraction, syncs, the nightly rollup, pattern detection, reviews and
notifications all run outside the request. There are two ways to run them, and
the app works either way.

### Option A — Vercel Cron (simplest)

`vercel.json` already declares the schedule. Set one secret:

```bash
CRON_SECRET=$(openssl rand -base64 32)
```

Add it to your Vercel environment variables. Vercel sends it as a bearer token
and `/api/cron/[job]` rejects anything else.

Capture extraction still runs immediately — it is dispatched inline, detached
from the request, so `POST /api/capture` still returns in under 100ms.

### Option B — Inngest (durable, retryable, observable)

1. <https://app.inngest.com> → create an app.
2. **Manage → Keys** for the event key and signing key:

```bash
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=signkey-prod-...
```

3. Register the endpoint: **Apps → Sync new app**, pointing at
   `https://your-domain.com/api/inngest`.

Locally:

```bash
npm run inngest    # starts the Inngest dev server
```

Its dashboard at <http://localhost:8288> shows every job run, its steps and its
retries.

### The schedule

| Job | When | What it does |
|---|---|---|
| `extract-capture` | on demand | Turns a capture into proposed objects |
| `rollover` | 00:05 | Carries open Today items over; clears expired snoozes |
| `generate-recurrences` | 00:30 | Materialises the next instance of a recurring item |
| `detect-patterns` | 02:00 | Journal themes at 3+ in 30 days; updates the personal model |
| `rollup-progress` | 03:00 | Recomputes the whole hierarchy; snapshots to `metric` |
| `sync-plaid` | 06:00, 14:00, 22:00 | Balances and transactions |
| `sync-calendar` | every 30 min | Incremental calendar sync |
| `schedule-notifications` | hourly | Decides what is worth interrupting you for |
| `send-notifications` | every 15 min | Flushes the queue |
| `weekly-review` | Sun 18:00 | Generates the weekly review |
| `monthly-review` | month end 18:00 | Generates the monthly review |

Any of them can be run by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.com/api/cron/rollup-progress
```

---

## 9. Deploying

### Vercel

```bash
npm i -g vercel
vercel link
vercel --prod
```

Add every variable from §12 under **Project → Settings → Environment
Variables**. Then set:

```bash
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

and go back and update the redirect URIs you registered in §2.5, §4.3, §5 and
§6.1 to the real domain.

### Before you ship

- [ ] `ENCRYPTION_KEY` is a fresh `openssl rand -base64 32`, not the dev default
- [ ] `LOCKIN_DEV_USER` is **not** set in production
- [ ] The Supabase pooler string is in `DATABASE_URL` (port 6543)
- [ ] `schema.sql` has been applied to the production database
- [ ] The `attachments` storage bucket exists
- [ ] Redirect URIs point at the production domain
- [ ] `npm run build` succeeds locally
- [ ] `npm test` and `npm run design:check` pass

### Rotating `ENCRYPTION_KEY`

Integration tokens are encrypted with it. Changing it invalidates every stored
token, and users will need to reconnect Plaid and Google. Do it deliberately.

---

## 10. Verifying it all works

Run through this once; it exercises every subsystem.

| # | Do this | You should see |
|---|---|---|
| 1 | `npm run dev`, open `/` | Home, with Today and progress by area |
| 2 | Press `?` | The shortcut sheet |
| 3 | Press `G` then `W` | The board, six columns |
| 4 | Drag a card between columns | The status changes; an undo toast appears |
| 5 | Press `⌘Z` | It moves back |
| 6 | Press `C`, type *"Email Sarah tomorrow about the portfolio"*, press `↵` | With a key: a task with tomorrow's date and a link to Sarah. Without: the raw text saved |
| 7 | Press `D`, type *"Finished the portfolio homepage. Ran 4 miles."* | The right column fills in with matches and confidences |
| 8 | Press `⌘↵` | A summary: items done, milestone reached, area delta |
| 9 | Go to `/goals/tree` | Rolled-up progress, and the delta from step 8 |
| 10 | Go to `/goals/roadmap`, drag a bar | The project and its milestones shift together |
| 11 | Go to `/goals/drift` | Stated priority against actual effort |
| 12 | Go to `/money` | Net worth, spending, goals with real projections |
| 13 | Go to `/memory` | Facts with evidence and Right/Wrong/Forget |
| 14 | Resize to 375px | Bottom tabs; the board becomes a segmented control |
| 15 | Settings → Theme → Dark | The whole app inverts with no layout shift |

Then the automated pass:

```bash
npm run typecheck && npm test && npm run design:check && npm run e2e
```

---

## 11. Troubleshooting

**`DATABASE_URL is not set`**
`.env.local` does not exist or the app was not restarted. Next only reads env
files at boot.

**`relation "object" does not exist`**
The schema was never applied. Run `npm run db:migrate`, or paste `schema.sql`
into the Supabase SQL editor.

**`type "vector" does not exist`**
The `vector` extension is not enabled. Supabase → Database → Extensions.

**`prepared statement "s1" already exists`**
You are using the direct connection string, not the transaction pooler. Switch
`DATABASE_URL` to the port 6543 URI.

**Everything returns 401**
No session and no `LOCKIN_DEV_USER`. Either sign in at `/login`, or add the dev
user line back for local work.

**Extraction never returns**
Check the terminal. `ANTHROPIC_API_KEY is not configured` means the key is
missing; a 402 means the Anthropic account has no credit. Either way the raw
capture is already saved and nothing is lost.

**Plaid Link does not open**
The CDN script from §4.2 is not in `layout.tsx`. Settings will also show Plaid
as unconfigured if the keys are missing.

**Google OAuth: `redirect_uri_mismatch`**
The URI in the Cloud Console must match byte for byte, including the scheme and
the absence of a trailing slash.

**Push subscribes but nothing arrives**
Confirm both VAPID keys are set and that the public one is the
`NEXT_PUBLIC_` variant. On iOS, the app must be installed to the home screen
first. Check `/api/cron/send-notifications` runs.

**A module fails to resolve with a mangled path**
Check the absolute path of the project for a `*` character. TypeScript resolves
a package `exports` wildcard by substituting the subpath into the *absolute*
path, so a directory named `Get your sh*t together` turns
`.../sh*t together/node_modules/zustand/esm/react.d.mts` into
`.../shreactt together/...` and the import fails.

Node and webpack resolve correctly — this only affects `tsc`, which means
`npm run typecheck` and `next build`, not `npm run dev`.

`tsconfig.json` carries a `paths` block that points at the affected files
directly; `paths` is consulted before the exports map, so it side-steps the bug.
Only `zustand` needs it today. If another package starts failing the same way,
add it to that block in the same shape. Moving the repo to a path without a `*`
removes the need for the block entirely.

**`npm run e2e` times out on first run**
The dev server compiles routes on demand. Run it once (`npm run dev`, click
around) or run the suite against a production build:
`npm run build && npm start`, then `E2E_BASE_URL=http://localhost:3000 npm run e2e`.

---

## 12. The complete environment reference

```bash
# ── Required ──────────────────────────────────────────────────────────────────
DATABASE_URL=                       # Postgres. Supabase: use the pooler, port 6543
NEXT_PUBLIC_SUPABASE_URL=           # unless LOCKIN_DEV_USER is set locally
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only — bypasses RLS

# ── Local development only ────────────────────────────────────────────────────
LOCKIN_DEV_USER=sam@example.com     # sign-in bypass; ignored in production

# ── Intelligence ──────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=                  # extraction, matching, breakdown, rewriting
ANTHROPIC_MODEL=claude-sonnet-5
OPENAI_API_KEY=                     # embeddings + Whisper
EMBEDDING_MODEL=text-embedding-3-small

# ── Money ─────────────────────────────────────────────────────────────────────
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox                   # sandbox | development | production

# ── Calendar ──────────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# ── Messaging ─────────────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
RESEND_API_KEY=
EMAIL_FROM="LockIn <hello@your-domain.com>"

# ── Push ──────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_VAPID_PUBLIC_KEY=       # public by design
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@your-domain.com

# ── Jobs ──────────────────────────────────────────────────────────────────────
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
CRON_SECRET=                        # openssl rand -base64 32

# ── Crypto ────────────────────────────────────────────────────────────────────
ENCRYPTION_KEY=                     # openssl rand -base64 32 — rotating it
                                    # invalidates every stored integration token

# ── App ───────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Which key unlocks what

| Key | Turns on | Without it |
|---|---|---|
| `DATABASE_URL` | Everything | The app shows a setup screen |
| Supabase keys | Real accounts, file uploads | Use `LOCKIN_DEV_USER` locally |
| `ANTHROPIC_API_KEY` | Extraction, breakdown, rewriting, what-if, should-I | Capture stores raw text; matching stays keyword-based |
| `OPENAI_API_KEY` | Semantic matching and duplicates, voice capture | Keyword + trigram matching; no voice |
| `PLAID_*` | Live balances and transactions | Manual accounts and captured expenses |
| `GOOGLE_*` | Free-block scheduling, calendar write-back | Ranking without calendar fit |
| `TWILIO_*` | Capture and complete by SMS | Browser only |
| `RESEND_API_KEY` | Digest email, push fallback | In-app only |
| VAPID keys | Browser push | Email notifications |
| `INNGEST_*` | Durable retryable jobs | Inline dispatch + Vercel Cron |
| `ENCRYPTION_KEY` | Storing integration tokens | Plaid and Google cannot connect |
