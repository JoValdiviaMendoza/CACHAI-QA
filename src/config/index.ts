/**
 * CACHAI-QA - Configuration Module
 * Carga y valida la configuración desde variables de entorno y archivo .env
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import {
  AppConfig,
  CrawlConfig,
  BrowserStackConfig,
  TestGenerationConfig,
  ReportConfig,
  BrowserType,
  ViewportSize,
  BrowserStackBrowserConfig
} from '../types';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Obtiene una variable de entorno con valor por defecto
 */
function getEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] ?? defaultValue;
}

/**
 * Obtiene una variable de entorno como número
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Obtiene una variable de entorno como booleano
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parsea lista separada por comas
 */
function parseList(value: string, defaultValue: string[] = []): string[] {
  if (!value) return defaultValue;
  return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
}

/**
 * Parsea configuración de navegadores BrowserStack
 */
function parseBrowserStackBrowsers(value: string): BrowserStackBrowserConfig[] {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    // Fallback: formato simple "chrome:Windows 10,firefox:Windows 10"
    return value.split(',').map(pair => {
      const [browser, os] = pair.split(':').map(s => s.trim());
      return { browser: browser as BrowserStackBrowserConfig['browser'], os };
    });
  }
}

/**
 * Normaliza una URL: antepone https:// si falta el esquema
 */
function normalizeUrl(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const host = trimmed.split('/')[0].split(':')[0].toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
  return `${isLocal ? 'http' : 'https'}://${trimmed}`;
}

/**
 * Valida que la URL objetivo sea válida
 */
function validateTargetUrl(url: string): void {
  if (!url) {
    throw new Error('TARGET_URL es obligatorio. Configúralo en .env');
  }
  try {
    new URL(url);
  } catch {
    throw new Error(`TARGET_URL inválida: ${url}`);
  }
}

/**
 * Valida credenciales de BrowserStack
 */
function validateBrowserStackConfig(config: BrowserStackConfig): void {
  if (!config.username || !config.accessKey) {
    throw new Error(
      'Credenciales de BrowserStack requeridas: BROWSERSTACK_USERNAME y BROWSERSTACK_ACCESS_KEY'
    );
  }
  if (config.browsers.length === 0) {
    throw new Error('Debe configurar al menos un navegador en BROWSERSTACK_BROWSERS');
  }
}

/**
 * Carga la configuración completa de la aplicación
 */
export function loadConfig(skipBrowserStackValidation: boolean = false): AppConfig {
  // Validar URL objetivo
  const targetUrl = normalizeUrl(getEnv('TARGET_URL'));
  validateTargetUrl(targetUrl);

  const baseUrl = new URL(targetUrl);
  const defaultAllowedDomains = [baseUrl.hostname];

  // Configuración de escaneo
  const crawl: CrawlConfig = {
    targetUrl,
    crawlDepth: getEnvNumber('CRAWL_DEPTH', 10),
    maxPages: getEnvNumber('MAX_PAGES', 99999),
    pageLoadTimeout: getEnvNumber('PAGE_LOAD_TIMEOUT', 30000),
    elementWaitTimeout: getEnvNumber('ELEMENT_WAIT_TIMEOUT', 10000),
    userAgent: getEnv('USER_AGENT') || undefined,
    browsers: parseList(getEnv('BROWSERS', 'chromium,firefox')) as BrowserType[],
    headless: getEnvBoolean('HEADLESS', true),
    viewport: {
      width: getEnvNumber('VIEWPORT_WIDTH', 1280),
      height: getEnvNumber('VIEWPORT_HEIGHT', 720)
    },
    allowedDomains: parseList(getEnv('ALLOWED_DOMAINS', ''), defaultAllowedDomains),
    blockedDomains: parseList(getEnv('BLOCKED_DOMAINS', 'facebook.com,twitter.com,linkedin.com,instagram.com,youtube.com')),
    ignoreUrlPatterns: parseList(getEnv('IGNORE_URL_PATTERNS', '.*\\.pdf$|.*\\.zip$|.*\\.exe$|.*mailto:.*|.*tel:.*')),
    maxConcurrency: getEnvNumber('MAX_CONCURRENCY', 3),
    retryCount: getEnvNumber('RETRY_COUNT', 2),
    requestDelay: getEnvNumber('REQUEST_DELAY', 500),
    respectRobotsTxt: getEnvBoolean('RESPECT_ROBOTS_TXT', true)
  };

  // Configuración BrowserStack
  const browserstack: BrowserStackConfig = {
    username: getEnv('BROWSERSTACK_USERNAME'),
    accessKey: getEnv('BROWSERSTACK_ACCESS_KEY'),
    projectName: getEnv('BROWSERSTACK_PROJECT_NAME', 'CACHAI-QA'),
    buildName: getEnv('BROWSERSTACK_BUILD_NAME', `cachai-qa-${Date.now()}`),
    browsers: parseBrowserStackBrowsers(getEnv('BROWSERSTACK_BROWSERS')),
    sessionTimeout: getEnvNumber('BROWSERSTACK_SESSION_TIMEOUT', 300),
    video: getEnvBoolean('BROWSERSTACK_VIDEO', true),
    networkLogs: getEnvBoolean('BROWSERSTACK_NETWORK_LOGS', true),
    consoleLogs: getEnvBoolean('BROWSERSTACK_CONSOLE_LOGS', true)
  };

  // Configuración de generación de pruebas
  const testGeneration: TestGenerationConfig = {
    checkBrokenLinks: getEnvBoolean('CHECK_BROKEN_LINKS', true),
    checkImages: getEnvBoolean('CHECK_IMAGES', true),
    checkForms: getEnvBoolean('CHECK_FORMS', true),
    checkButtons: getEnvBoolean('CHECK_BUTTONS', true),
    checkConsoleErrors: getEnvBoolean('CHECK_CONSOLE_ERRORS', true),
    checkA11yBasic: getEnvBoolean('CHECK_A11Y_BASIC', true)
  };

  // Configuración de reportes
  const report: ReportConfig = {
    reportDir: getEnv('REPORT_DIR', './reports'),
    generateHtmlReport: getEnvBoolean('GENERATE_HTML_REPORT', true),
    generateJsonReport: getEnvBoolean('GENERATE_JSON_REPORT', true)
  };

  const config: AppConfig = {
    crawl,
    browserstack,
    testGeneration,
    report
  };

  // Validaciones finales
  if (!skipBrowserStackValidation) {
    validateBrowserStackConfig(config.browserstack);
  }

  return config;
}

/**
 * Configuración por defecto (para testing o CLI overrides)
 */
export function getDefaultConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const baseConfig = loadConfig();
  return deepMerge(baseConfig, overrides) as AppConfig;
}

/**
 * Merge profundo de objetos
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];
    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, any>)[key] = deepMerge(
        targetValue as Record<string, any>,
        sourceValue as Record<string, any>
      );
    } else if (sourceValue !== undefined) {
      (result as Record<string, any>)[key] = sourceValue;
    }
  }
  return result;
}

/**
 * Valida configuración para ejecución local (sin BrowserStack)
 */
export function validateLocalConfig(config: AppConfig): void {
  if (!config.crawl.targetUrl) {
    throw new Error('TARGET_URL es obligatorio');
  }
  if (config.crawl.browsers.length === 0) {
    throw new Error('Debe especificar al menos un navegador');
  }
}

/**
 * Crea directorio de reportes si no existe
 */
export function ensureReportDir(reportDir: string): void {
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
}

export { AppConfig, CrawlConfig, BrowserStackConfig, TestGenerationConfig, ReportConfig };