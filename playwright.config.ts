import { defineConfig, devices } from '@playwright/test';

/**
 * Every flow runs at four viewports, and each has a viewport-specific
 * assertion. That is what stops the phone version quietly becoming a second,
 * worse product.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Next's dev server compiles routes on demand, so heavy parallelism against
  // it produces timeouts that are not product failures. Against a production
  // build (how CI runs it) this can go wider.
  // Next's dev server compiles routes on demand, so heavy parallelism produces
  // timeouts that are not product failures.
  workers: 2,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'wide', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'standard', use: { ...devices['Desktop Chrome'], viewport: { width: 1200, height: 800 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 834, height: 1112 } } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } } },
  ],
  /**
   * Always the dev server, deliberately.
   *
   * `LOCKIN_DEV_USER` is inert when NODE_ENV is production — that guard is the
   * whole point of it — so a production build has no way to sign in without a
   * real auth provider. CI still runs `npm run build` as its own step to prove
   * the app compiles; these tests exercise behaviour, not the bundler.
   */
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
