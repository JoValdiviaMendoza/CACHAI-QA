import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const isBrowserStack = process.env.BROWSERSTACK_USERNAME && process.env.BROWSERSTACK_ACCESS_KEY;

const baseConfig = {
  testDir: './tests',
  timeout: parseInt(process.env.PAGE_LOAD_TIMEOUT || '30000', 10),
  expect: { timeout: 10000 },
  fullyParallel: true,
  retries: parseInt(process.env.RETRY_COUNT || '2', 10),
  workers: isBrowserStack ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'reports/playwright-report', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
    ['list']
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: parseInt(process.env.PAGE_LOAD_TIMEOUT || '30000', 10)
  }
};

const localProjects = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } }
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 720 } }
  }
];

const bsProjects = (process.env.BROWSERSTACK_BROWSERS ? JSON.parse(process.env.BROWSERSTACK_BROWSERS) : [
  { browser: 'chrome', os: 'Windows 10' },
  { browser: 'firefox', os: 'Windows 10' }
]).map((b: any, i: number) => ({
  name: `bs-${b.browser}-${b.os}`,
  use: {
    browserName: b.browser === 'chrome' ? 'chromium' : b.browser === 'firefox' ? 'firefox' : 'webkit',
    viewport: { width: 1280, height: 720 },
  }
}));

export default defineConfig({
  ...baseConfig,
  projects: isBrowserStack ? bsProjects : localProjects,
  // Configuración específica para BrowserStack
  ...(isBrowserStack && {
    // BrowserStack requiere configuración vía variables de entorno o playwright.config
    // Las credenciales se pasan via BROWSERSTACK_USERNAME / BROWSERSTACK_ACCESS_KEY
  })
});