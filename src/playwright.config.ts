import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { browserStackWsEndpoint, browserStackBuildName, DEFAULT_BROWSERSTACK_TARGETS, hasBrowserStackCredentials } from './core/browserstack';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// BrowserStack solo se activa de forma explícita. Tener credenciales en .env
// no cambia el comportamiento de una ejecución local normal.
const isBrowserStack = process.env.CACHAI_BROWSERSTACK === '1' && hasBrowserStackCredentials();
const browserStackBuild = process.env.CACHAI_BROWSERSTACK_BUILD || browserStackBuildName();

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

const browserStackProjects = isBrowserStack ? DEFAULT_BROWSERSTACK_TARGETS.map((target) => ({
  name: `bs-${target.id}`,
  use: {
    browserName: 'chromium' as const,
    viewport: { width: 1280, height: 720 },
    connectOptions: {
      wsEndpoint: browserStackWsEndpoint(target, {
        buildName: browserStackBuild,
        sessionName: `CACHAI-QA · ${target.label}`
      })
    }
  }
})) : [];

export default defineConfig({
  ...baseConfig,
  projects: isBrowserStack ? browserStackProjects : localProjects
});
