import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Setup project - authenticate before running tests
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Chromium for all tests
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use authenticated state if available
        storageState: process.env.STORAGE_STATE || undefined,
      },
      dependencies: ['setup'],
    },

    // Mobile Safari for responsive tests
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
        storageState: process.env.STORAGE_STATE || undefined,
      },
      dependencies: ['setup'],
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
});
