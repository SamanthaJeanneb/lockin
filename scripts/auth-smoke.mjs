/**
 * End-to-end check of the sign-up / sign-in / sign-out cycle against a running
 * deployment, in a real browser. Creates a throwaway account, walks it all the
 * way through onboarding, signs it out, and signs it back in.
 *
 *   BASE=https://your-deployment.vercel.app node scripts/auth-smoke.mjs
 *
 * The account it creates is real. Delete it from Supabase Auth afterwards, or
 * point BASE at a staging project.
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const email = `lockin.smoke.${Date.now()}@example.com`;
const password = 'smoke-pass-12345';
const log = (...a) => console.log(...a);
let failures = 0;
function check(name, ok, extra = '') {
  log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
}


/** Fills a controlled input and makes sure the value survived — typing before
 *  React hydrates leaves the DOM filled and the component state empty, and the
 *  next render wipes it. Only a problem for a robot; people are slower. */
async function type(page, selector, value) {
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.fill(selector, value);
    await page.waitForTimeout(250);
    if ((await page.inputValue(selector)) === value) return;
  }
  throw new Error(`could not fill ${selector} — the form never hydrated`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

try {
  // 1. Protected route bounces to login, keeping the destination.
  await page.goto(`${BASE}/goals`, { waitUntil: 'domcontentloaded' });
  check('anonymous /goals -> /login?next=/goals', page.url().includes('/login?next=%2Fgoals'), page.url());

  // 2. No dead OAuth buttons for providers the project has disabled.
  const body = await page.textContent('body');
  check('login offers only enabled providers', !/Google|GitHub/.test(body), body.match(/Google|GitHub/)?.[0] ?? 'email only');

  // 3. Sign up.
  await page.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded' });
  await type(page, 'input[autocomplete="name"]', 'Smoke Tester');
  await type(page, 'input[type="email"]', email);
  await type(page, 'input[type="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/signup'), { timeout: 60000 }),
    page.click('button[type="submit"]'),
  ]);
  check('signup signs the new account in', !/\/(login|signup)/.test(page.url()), page.url());

  // 4. A brand-new account is held at onboarding — and can still get out.
  await page.waitForURL('**/onboarding', { timeout: 30000 }).catch(() => {});
  check('new account lands on onboarding', page.url().includes('/onboarding'), page.url());
  check('onboarding offers a way out', await page.isVisible('button:has-text("Sign out")'));

  // 5. Walk through onboarding so the rest of the app is reachable.
  for (let i = 0; i < 3; i++) await page.click('button:has-text("Skip")');
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/onboarding'), { timeout: 60000 }),
    page.click('button:has-text("Start using it")'),
  ]);
  check('onboarding completes into the app', !page.url().includes('/onboarding'), page.url());

  // 6. The session is a cookie, so it survives a hard reload.
  await page.goto(`${BASE}/goals/tree`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  check('signed-in /goals/tree stays put', page.url().includes('/goals/tree'), page.url());

  // 7. A signed-in user has no business on the login page.
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  check('signed-in /login redirects away', !page.url().includes('/login'), page.url());

  // 8. Sign out from Settings.
  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Signed in as', { timeout: 40000 });
  check('settings names the signed-in account', (await page.textContent('body')).includes(email));
  await Promise.all([
    page.waitForURL('**/login**', { timeout: 40000 }),
    page.click('button:has-text("Sign out")'),
  ]);
  check('sign out lands on /login', page.url().includes('/login'), page.url());

  // 9. The session is really gone, not just navigated away from.
  const authCookies = (await ctx.cookies()).filter((c) => c.name.includes('auth-token') && c.value);
  check('no auth cookie survives sign out', authCookies.length === 0, authCookies.map((c) => c.name).join(','));
  await page.goto(`${BASE}/goals`, { waitUntil: 'domcontentloaded' });
  check('after sign out /goals bounces again', page.url().includes('/login'), page.url());

  // 10. Sign back in with the same credentials.
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await type(page, 'input[type="email"]', email);
  await type(page, 'input[type="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
    page.click('button[type="submit"]'),
  ]);
  check('sign back in works', !page.url().includes('/login'), page.url());

  // 11. Wrong password is refused, in plain language.
  await ctx.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await type(page, 'input[type="email"]', email);
  await type(page, 'input[type="password"]', 'definitely-wrong-password');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => /do not match/i.test(document.body.innerText), null, { timeout: 30000 })
    .catch(() => {});
  const shown = await page.textContent('body');
  check(
    'wrong password shows a readable error',
    /do not match an account/i.test(shown) && page.url().includes('/login'),
    shown.match(/That email[^.]*\./)?.[0] ?? 'no message',
  );
} catch (e) {
  failures++;
  log('FAIL  threw:', e.message.split('\n')[0]);
  await page.screenshot({ path: 'auth-smoke-failure.png' }).catch(() => {});
} finally {
  await browser.close();
}
log(`\ntest account: ${email}`);
log(failures ? `${failures} FAILED` : 'all checks passed');
process.exit(failures ? 1 : 0);
