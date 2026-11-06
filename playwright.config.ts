import { defineConfig, devices } from '@playwright/test';
import { E2E_ENV, E2E_PORT } from './e2e/env.ts';

// The E2E suite runs the built client against the real server with a fresh
// database (e2e/env.ts). `pnpm build` must have run before.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: 'off',
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@phone/,
    },
    { name: 'phone', use: { ...devices['Pixel 7'] }, grep: /@phone/ },
  ],
  webServer: {
    command: 'node e2e/start-server.ts',
    url: `http://localhost:${E2E_PORT}/healthz`,
    env: E2E_ENV,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
