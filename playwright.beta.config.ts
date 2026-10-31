import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
const root = process.env.LP_ANALYSIS_DIR ?? path.resolve('artifacts/analysis-live-proof');
export default defineConfig({
  testDir: './e2e-live', outputDir: './artifacts/live-browser-tests', timeout: 300000, workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] } },
  projects: [{ name: 'chromium-live-owner-beta', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: { command: 'node scripts/beta-launch.mjs', url: 'http://127.0.0.1:3100', timeout: 60000, reuseExistingServer: false,
    env: { LP_ANALYSIS_DIR: root, BETA_PORT: '3100', NEXT_TELEMETRY_DISABLED: '1' } },
});
