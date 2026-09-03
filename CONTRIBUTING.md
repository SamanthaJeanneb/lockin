# Working on Life OS

## Before you push

```bash
npm run check     # typecheck + design:check + unit tests
npm run e2e       # four viewports
```

CI runs all of it plus a production build. Both checks are cheap; run them.

## The rules that are not negotiable

These are enforced, not conventions. `npm run design:check` fails on the first
five; `e2e/design.spec.ts` checks the rendered result in a browser.

1. **No hex outside `tokens.css`.** The one documented exception is
   `src/lib/brand.ts`, which exists because browser `theme-color` metadata and
   email HTML render where CSS variables do not.
2. **No arbitrary Tailwind values** for colour or spacing. If a value is not in
   the scale, the scale is wrong — add it to `tokens.css`, map it in
   `globals.css`, then use it. Geometry (`w-[280px]`, `top-[12vh]`) is fine.
3. **No `dark:` variants.** Themes swap at the token layer. One attribute on
   `<html>` changes the whole system.
4. **Nothing over an 8px radius.** Controls 6px, modals 8px, chips 3px.
   `rounded-full` is for avatars and progress-bar caps only.
5. **No gradients, no glassmorphism, no backdrop blur.**
6. **No accent colour.** Chromatic values are permitted inside charts and
   trajectory indicators, and nowhere else. Colour never carries meaning alone —
   pair it with a word or a label.
7. **Sections are not cards.** A heading, some space, and a hairline rule.
   The bordered-rounded-padded container around a group of settings is the most
   recognisable generated-UI tell there is.
8. **Shadows only on overlays.** A card in the content area has a 1px border.

## Adding an object type

A data change, not a code change:

1. Add a row to `supabase/migrations/0003_vocabulary.sql`.
2. Add its icon to `iconFor()` in `ObjectDetail.tsx`.

That is all. It appears in the extraction prompt, in search, in the timeline, and
`ObjectRow` and `ObjectDetail` render it. Do not write a new component for it.

## Adding a screen

1. Create `src/app/(app)/<route>/page.tsx`.
2. Compose from `components/ui` and `components/composite`. If a primitive is
   missing, build the primitive first — no page composes raw elements when a
   primitive exists, or should exist.
3. Add it to `NAV` in `Sidebar.tsx` if it is a destination.
4. Add it to the route sweep in `e2e/views.spec.ts`.
5. Check it at 375px before you call it done. Not "it does not crash" — check
   that every action is still reachable.

## Adding a background job

1. Write it as a plain async function in `src/jobs/`, exported from
   `src/jobs/index.ts`. Take `{ userId }` optionally and process everyone when it
   is absent.
2. Add it to the `JOBS` map in `src/app/api/cron/[job]/route.ts`.
3. Add an Inngest function in `src/lib/inngest/functions.ts`.
4. Add the schedule to `vercel.json`.

One implementation, three triggers. Never fork the logic.

## Adding an API route

Use the helpers. `requireUser()`, `parseBody(req, ZodSchema)`, `ok()`, and wrap
the whole handler in `try { … } catch (e) { return handleError(e) }`. Rate-limit
anything that costs money.

Every query filters by `user_id` explicitly, even though RLS would also catch it.

## Testing

- **Vitest** for logic: rollup maths, trajectory, match scoring, extraction
  parsing, financial projections, breakpoint resolution. Test the contract, not
  the implementation.
- **Testing Library** for interactive components, including the keyboard path.
  If `E` completes a row, there is a test that presses `E`.
- **Playwright** at 1440 / 1200 / 834 / 375, with a viewport-specific assertion
  at each. A test that passes identically at every width is not testing the
  responsive contract.

Do not assert on seeded row titles that a smoke test might complete. Assert on
the contract — that a match appears and is tiered, not that one specific task
appears.


## Two things about the E2E suite that will otherwise cost you an hour

**Wait for hydration, not for `load`.** `page.goto` resolves before React has
registered the global key handler, so pressing `?` immediately does nothing —
correctly, because nothing is listening yet. Use `gotoApp(page, path)` from
`e2e/helpers.ts`; it waits for `html[data-hydrated="true"]`, which `AppShell`
stamps in its mount effect.

**The four viewports share one database.** A test that completes a seeded row
will pass for whichever project runs first and fail for the rest. Create the row
you are going to mutate, then delete it. `daily-loop.spec.ts` shows the pattern.

The suite runs against the dev server on purpose. `LIFEOS_DEV_USER` is inert
when `NODE_ENV` is production — that guard is the point of it — so a production
build has no way to sign in without a real auth provider. CI runs
`npm run build` as its own step to prove the app compiles.
