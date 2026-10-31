import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 45000, fullyParallel: false, workers: 1,
  reporter: 'list', use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: { command: 'npm run start', url: 'http://127.0.0.1:3000', timeout: 60000, reuseExistingServer: false, env: { NEXT_TELEMETRY_DISABLED: '1' } },
});
