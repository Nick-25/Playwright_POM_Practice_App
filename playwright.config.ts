import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // Keep each test reasonably short. If an assertion waits for an element,
  // that wait is included in this timeout.
  timeout: 30_000,

  // Run tests in parallel by default, which is the normal Playwright Test style.
  fullyParallel: true,

  // CI settings make the suite less flaky in build pipelines while keeping
  // local runs fast and direct.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html'],
    ['list'],
    [
      'playwright-ctrf-json-reporter',
      {
        outputDir: 'ctrf',
        outputFile: 'ctrf-report.json',
        appName: 'Playwright POM Practice App',
        testType: 'e2e',
      },
    ],
  ],

  webServer: {
    command: 'node server.js',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  use: {
    baseURL: 'http://127.0.0.1:3000',

    // A trace gives you a time-travel style recording when a test is retried.
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // This Windows workstation needs Firefox's content sandbox disabled so
        // Playwright can create tabs. Remove this if Firefox launches normally.
        launchOptions:
          process.platform === 'win32'
            ? { env: { ...process.env, MOZ_DISABLE_CONTENT_SANDBOX: '1' } }
            : undefined,
      },
    },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
});
