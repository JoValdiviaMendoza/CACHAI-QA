/**
 * CACHAI-QA - BrowserStack
 *
 * Centraliza lo único que el usuario debe configurar: usuario y access key.
 * El resto (proyecto, build, navegadores, capacidades y túnel local) se
 * resuelve automáticamente con valores seguros.
 */

import * as os from 'os';
import { BrowserStackBrowserConfig } from '../types';

const BROWSERSTACK_ENDPOINT = 'wss://cdp.browserstack.com/playwright';
const PROJECT_NAME = 'CACHAI-QA';

export interface BrowserStackCredentials {
  username: string;
  accessKey: string;
}

export interface BrowserStackTarget {
  id: 'chromium' | 'firefox' | 'webkit' | 'edge';
  browser: string;
  browser_version?: string;
  os: string;
  os_version: string;
  label: string;
}

export interface BrowserStackRunOptions {
  buildName?: string;
  sessionName?: string;
  local?: boolean;
  localIdentifier?: string;
}

/**
 * Navegadores por defecto. No requiere configuración adicional: Chrome,
 * Firefox y WebKit/Safari en las versiones estables de BrowserStack.
 */
export const DEFAULT_BROWSERSTACK_TARGETS: BrowserStackTarget[] = [
  {
    id: 'chromium',
    browser: 'chrome',
    browser_version: 'latest',
    os: 'Windows',
    os_version: '11',
    label: 'Chrome · Windows 11'
  },
  {
    id: 'firefox',
    browser: 'playwright-firefox',
    os: 'Windows',
    os_version: '11',
    label: 'Firefox · Windows 11'
  },
  {
    id: 'webkit',
    browser: 'playwright-webkit',
    os: 'OS X',
    os_version: 'Sonoma',
    label: 'WebKit/Safari · macOS Sonoma'
  },
  {
    id: 'edge',
    browser: 'edge',
    browser_version: 'latest',
    os: 'Windows',
    os_version: '11',
    label: 'Edge · Windows 11'
  }
];

function clean(value: string | undefined): string {
  return String(value || '').trim();
}

function isPlaceholder(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized === '' ||
    normalized === 'tu_usuario_browserstack' ||
    normalized === 'tu_access_key_browserstack' ||
    normalized === 'your_username' ||
    normalized === 'your_access_key' ||
    normalized === 'username' ||
    normalized === 'access_key'
  );
}

/** Devuelve las credenciales solo si están completas y no son placeholders. */
export function getBrowserStackCredentials(env: NodeJS.ProcessEnv = process.env): BrowserStackCredentials | null {
  const username = clean(env.BROWSERSTACK_USERNAME);
  const accessKey = clean(env.BROWSERSTACK_ACCESS_KEY);
  if (isPlaceholder(username) || isPlaceholder(accessKey)) return null;
  return { username, accessKey };
}

export function hasBrowserStackCredentials(env: NodeJS.ProcessEnv = process.env): boolean {
  return getBrowserStackCredentials(env) !== null;
}

/** Nombre de build único y legible, sin pedir configuración adicional. */
export function browserStackBuildName(prefix = 'cachai-qa'): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/** Identificador estable para BrowserStack Local. */
export function browserStackLocalIdentifier(buildName?: string): string {
  const host = os.hostname().replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `cachai-qa-${host}-${buildName || browserStackBuildName()}`.slice(0, 80);
}

export function browserStackDashboardUrl(buildName?: string): string {
  const base = 'https://automate.browserstack.com/dashboard/v2/builds';
  if (!buildName) return base;
  return `${base}?search=${encodeURIComponent(buildName)}`;
}

/** Convierte un nombre local de navegador al target de BrowserStack. */
export function resolveBrowserStackTarget(browser: string | undefined): BrowserStackTarget {
  const key = clean(browser).toLowerCase();
  if (key === 'firefox') return DEFAULT_BROWSERSTACK_TARGETS[1];
  if (key === 'webkit' || key === 'safari') return DEFAULT_BROWSERSTACK_TARGETS[2];
  if (key === 'edge' || key === 'msedge') return DEFAULT_BROWSERSTACK_TARGETS[3];
  return DEFAULT_BROWSERSTACK_TARGETS[0];
}

/** Target de BrowserStack a partir de una config del CLI antiguo. */
export function resolveBrowserStackTargetFromConfig(
  config: BrowserStackBrowserConfig | undefined
): BrowserStackTarget {
  if (!config) return DEFAULT_BROWSERSTACK_TARGETS[0];
  if (config.device) {
    return {
      id: 'webkit',
      browser: 'playwright-webkit',
      os: config.os || 'OS X',
      os_version: config.os_version || 'Sonoma',
      label: config.device
    };
  }
  const browser = clean(config.browser).toLowerCase();
  if (browser === 'firefox' || browser === 'playwright-firefox') return DEFAULT_BROWSERSTACK_TARGETS[1];
  if (browser === 'safari' || browser === 'webkit' || browser === 'playwright-webkit') {
    return DEFAULT_BROWSERSTACK_TARGETS[2];
  }
  if (browser === 'edge') return DEFAULT_BROWSERSTACK_TARGETS[3];
  return {
    ...DEFAULT_BROWSERSTACK_TARGETS[0],
    os: config.os || DEFAULT_BROWSERSTACK_TARGETS[0].os,
    os_version: config.os_version || DEFAULT_BROWSERSTACK_TARGETS[0].os_version
  };
}

/**
 * Construye las capacidades públicas de una sesión. Las credenciales se
 * leen del entorno y nunca se escriben en archivos generados.
 */
export function buildBrowserStackCaps(
  target: BrowserStackTarget,
  options: BrowserStackRunOptions = {},
  env: NodeJS.ProcessEnv = process.env
): Record<string, string | boolean> {
  const credentials = getBrowserStackCredentials(env);
  if (!credentials) {
    throw new Error(
      'BrowserStack requiere BROWSERSTACK_USERNAME y BROWSERSTACK_ACCESS_KEY en src/.env.'
    );
  }

  const caps: Record<string, string | boolean> = {
    browser: target.browser,
    os: target.os,
    os_version: target.os_version,
    'browserstack.username': credentials.username,
    'browserstack.accessKey': credentials.accessKey,
    project: PROJECT_NAME,
    build: options.buildName || browserStackBuildName(),
    name: options.sessionName || `${PROJECT_NAME} · ${target.label}`,
    'browserstack.debug': true,
    'browserstack.console': 'errors',
    'browserstack.networkLogs': true,
    'browserstack.video': true,
    'browserstack.playwrightVersion': '1.latest',
    'client.playwrightVersion': '1.latest',
    'browserstack.local': options.local ? 'true' : 'false'
  };

  if (target.browser_version) caps.browser_version = target.browser_version;
  if (options.local) {
    caps['browserstack.localIdentifier'] =
      options.localIdentifier || browserStackLocalIdentifier(options.buildName);
  }

  return caps;
}

/** Endpoint WebSocket de BrowserStack para Playwright. */
export function browserStackWsEndpoint(
  target: BrowserStackTarget,
  options: BrowserStackRunOptions = {},
  env: NodeJS.ProcessEnv = process.env
): string {
  const caps = buildBrowserStackCaps(target, options, env);
  return `${BROWSERSTACK_ENDPOINT}?caps=${encodeURIComponent(JSON.stringify(caps))}`;
}

/** Indica si una URL solo es accesible desde la máquina local. */
export function isLocalTargetUrl(targetUrl: string): boolean {
  try {
    const host = new URL(targetUrl).hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local')
    ) {
      return true;
    }
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^169\.254\./.test(host)) return true;
    const private172 = /^172\.(\d{1,3})\./.exec(host);
    if (private172) {
      const octet = Number(private172[1]);
      if (octet >= 16 && octet <= 31) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Inicia BrowserStack Local para que la nube pueda acceder a localhost o a
 * una red privada. Usa la misma access key; no requiere configuración extra.
 */
export async function startBrowserStackLocal(
  buildName?: string,
  localIdentifier?: string
): Promise<{ identifier: string; stop: () => Promise<void> }> {
  const credentials = getBrowserStackCredentials();
  if (!credentials) {
    throw new Error(
      'BrowserStack Local requiere BROWSERSTACK_USERNAME y BROWSERSTACK_ACCESS_KEY.'
    );
  }

  // Se carga de forma perezosa para que el resto del framework funcione
  // aunque BrowserStack Local no esté instalado.
  let BrowserStackLocal: { Local: new () => { start: Function; stop: Function; isRunning?: () => boolean } };
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    BrowserStackLocal = require('browserstack-local');
  } catch {
    throw new Error(
      'Falta la dependencia browserstack-local. Ejecuta la opción [8] del menú para instalar dependencias.'
    );
  }

  const identifier = localIdentifier || browserStackLocalIdentifier(buildName);
  const tunnel = new BrowserStackLocal.Local();

  await new Promise<void>((resolve, reject) => {
    tunnel.start(
      {
        key: credentials.accessKey,
        forceLocal: true,
        onlyAutomate: true,
        localIdentifier: identifier
      },
      (error?: Error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });

  return {
    identifier,
    stop: () =>
      new Promise<void>((resolve) => {
        try {
          if (typeof tunnel.isRunning === 'function' && !tunnel.isRunning()) {
            resolve();
            return;
          }
          tunnel.stop(() => resolve());
        } catch {
          resolve();
        }
      })
  };
}

export { PROJECT_NAME as BROWSERSTACK_PROJECT_NAME };
