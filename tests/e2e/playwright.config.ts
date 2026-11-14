import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const state = path.join(here, '.state');

export const API = 'http://localhost:8791';
export const APP = 'http://localhost:5173/training/';

/**
 * Stack: local worker (wrangler dev, D1 in tests/e2e/.state, wiped on every run) + Vite on 5173
 * (the only origin the worker's CORS allows). Both are started fresh; a busy port fails the run.
 */
export default defineConfig({
  testDir: here,
  outputDir: path.join(here, '.results'),
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 4,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: path.join(here, '.report'), open: 'never' }]],
  use: {
    baseURL: APP,
    locale: 'ru-RU',
    // The worker takes "today" as the UTC date (the app sends no local date), so the suite runs in UTC to stay
    // stable at any hour. timezone.spec.ts checks what happens elsewhere.
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'iphone',
      testIgnore: /desktop\.spec\.ts/,
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      },
    },
    {
      name: 'desktop',
      testMatch: /desktop\.spec\.ts/,
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: `rm -rf "${state}" && npx wrangler@4 d1 migrations apply training --local --persist-to "${state}" && npx wrangler@4 dev --local --port 8791 --persist-to "${state}"`,
      cwd: path.join(root, 'worker'),
      url: `${API}/api/me`, // 401 counts as "up"
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'npx vite --port 5173 --strictPort',
      cwd: root,
      env: { VITE_API_URL: API },
      url: APP,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
