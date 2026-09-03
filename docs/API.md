# API reference

Every route is a Next.js Route Handler under `/api`, authenticated by the
Supabase session cookie (or `LOCKIN_DEV_USER` locally), and scoped by `user_id`
in code as well as by row-level security in the database.

Errors share one shape: `{ "error": "message" }` with a status of 401
(not signed in), 422 (invalid body, with `issues`), 429 (rate limited), 503
(a required key is not configured — the message names it) or 500.

## Capture

```
POST   /api/capture                 { channel?, rawText?, mediaUrl?, transcript?, meta? }
                                    → { captureId }            201, under 100ms
GET    /api/capture/:id             → { rawText, transcript, processedAt, resolvedAt,
                                        extraction, error }
POST   /api/capture/:id/resolve     { accept: string[], reject?, edits?, noteOnly? }
                                    → { created: [...], tmpToId }
```

The raw row is committed before extraction is dispatched, so nothing typed can
be lost to an API failure. Poll the `GET` until `processedAt` is set.

## Objects

```
GET    /api/objects                 ?type&status&area&horizon&goal&project&person
                                    &due_before&completed&archived&q&limit&offset&order&dir
                                    → { objects }
POST   /api/objects                 { type, title, ...optional, linkTo? } → { object }
GET    /api/objects/:id             → { object, edges: Hop[], why: [...] }
PATCH  /api/objects/:id             partial → { object, deltas? }
DELETE /api/objects/:id             soft delete → { undoToken }
POST   /api/objects/:id/restore     → { restored }
POST   /api/objects/bulk            { ids, action, payload } → { updated }
```

`type`, `status` and `goal`/`project`/`person` may be repeated. Relationship
filters go through the `edge` table, never a `props` lookup. Bulk actions:
`complete` `uncomplete` `status` `priority` `area` `snooze` `schedule` `delete`
`archive` `link_goal` `link_project`.

## Edges

```
POST   /api/edges                   { fromId, toId, rel } → { edge }
DELETE /api/edges/:id               → { deleted }
```

`rel` is one of `supports` `part_of` `blocks` `with` `about` `recommended_by`
`mentions` `related` `attended` `references` `source_of` `evidence_for`.
Creating or removing a `supports` / `part_of` edge triggers a rollup.

## The daily loop

```
GET    /api/today                   ?available_minutes
                                    → { items, freeBlocks, areas, events, oneThing }
POST   /api/debrief                 { text }
                                    → { captureId, matches, notDone, newObjects,
                                        expenses, journal }
POST   /api/debrief/confirm         { captureId, text, completed, notDone, newObjects,
                                        expenses, journal, mood, tomorrow, habitValues }
                                    → { summary: string[], deltas }
```

Each Today item carries `why` — one sentence generated from whichever ranking
factor dominated. Debrief matches carry `score`; ≥0.85 arrives checked,
0.50–0.84 arrives unchecked with the match named, below 0.50 is not offered.

## Goals and planning

```
GET    /api/goals/tree              → { roots, areas } — nested, with progress,
                                       trajectory and a seven-day delta
GET    /api/goals/drift             ?period=YYYY-MM
                                    → { stated, actual, observations }
GET    /api/roadmap                 ?from&to&zoom=week|month|quarter|year|five
                                    → { buckets, bars, load }
```

## Intelligence

```
POST   /api/ai/breakdown            { objectId, apply? } → { milestones, created? }
POST   /api/ai/recommend            { availableMinutes?, limit? } → { items }
POST   /api/ai/rewrite              { text, action, personId? } → { text }
POST   /api/ai/should-i             { question, save? } → { improves, costs, conflicts,
                                                            net, recommendation, decisionId }
POST   /api/search                  { query, answer? } → { results, answer? }
POST   /api/transcribe              multipart: audio → { text }
```

`action` is `improve` `shorter` `warmer` `professional` `casual` `clearer`
`sound_like_me`. Breakdown preserves completed items when regenerating.

## Money

```
GET    /api/money/dashboard         → { metrics, history, accounts, spendingCategories,
                                        anomalies, recurring, goals, debtPlan }
POST   /api/money/link-token        → { linkToken }
POST   /api/money/exchange          { publicToken } → { integrationId }
POST   /api/money/what-if           { question, save? } → scenario + goal impacts
GET    /api/money/what-if           → { scenarios }
```

Plaid access tokens are exchanged server-side, encrypted at rest and never sent
to the browser.

## Personal model, reviews and the rest

```
GET    /api/memory                  ?all → { categories, total }
PATCH  /api/memory/:id              { status, statement? } → { fact }
POST   /api/memory/ask              { question } → { answer }

GET    /api/review/:period          ?start   period = weekly | monthly | annual
POST   /api/review/:period/confirm  { answers, changes, isPublic? }

GET    /api/areas                   → { areas }
GET    /api/activity                ?limit → { activity }
GET    /api/timeline                ?from&to&type… → { events, heat }

GET    /api/settings                → { user, settings, areas, integrations, available }
PATCH  /api/settings                partial
PATCH  /api/settings/ui             UiState → 204

GET    /api/views                   ?surface → { views }
POST   /api/views                   { name, surface, filters, sort, columns?, isPinned }
PATCH  /api/views/:id
DELETE /api/views/:id

POST   /api/upload                  multipart: file, objectId? → { id, path, text }
GET    /api/export                  ?format=json|markdown → a file download
POST   /api/push/subscribe          PushSubscription JSON → { subscribed }
DELETE /api/push/subscribe          ?endpoint
```

## Integrations, webhooks and jobs

```
GET    /api/integrations/google/start        → OAuth redirect
GET    /api/integrations/google/callback     → back to /settings

POST   /api/webhooks/plaid          Plaid item and transaction events
POST   /api/webhooks/twilio         inbound SMS → capture → TwiML reply
POST   /api/webhooks/calendar       Google push channel

GET    /api/cron/:job               Bearer CRON_SECRET
       rollover · generate-recurrences · detect-patterns · rollup-progress
       learn-cadence · detect-interests · sync-plaid · sync-calendar
       schedule-notifications · send-notifications · weekly-review
       monthly-review · annual-review

GET|POST|PUT /api/inngest           the Inngest handler
```

## Rate limits

Per user, per minute: capture 60, debrief 40, rewrite 40, recommend 60,
breakdown 20, should-i 20, what-if 20, memory/ask 20, transcribe 20. Exceeding
one returns 429 with a plain-language message.
