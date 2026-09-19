import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/e2e.spec.ts',
  fullyParallel: true,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure', reducedMotion: 'reduce' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 1000 } } }],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 30_000 },
});
