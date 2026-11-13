/**
 * CACHAI-QA - Browser Manager
 * Wrapper de Playwright para gestión de navegadores (local y BrowserStack)
 */

import { Browser, BrowserContext, Page, chromium, firefox, webkit, BrowserType as PWBrowserType } from '@playwright/test';
import { BrowserStackConfig, BrowserStackBrowserConfig, CrawlConfig, ViewportSize, BrowserContextOptions } from '../types';
import { browserStackWsEndpoint, resolveBrowserStackTargetFromConfig } from './browserstack';

export interface BrowserInstance {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  cleanup: () => Promise<void>;
}

export interface BrowserManagerOptions {
  crawlConfig: CrawlConfig;
  browserstackConfig?: BrowserStackConfig;
  targetBrowserConfig?: BrowserStackBrowserConfig;
  isBrowserStack: boolean;
}

export class BrowserManager {
  private crawlConfig: CrawlConfig;
  private browserstackConfig?: BrowserStackConfig;
  private targetBrowserConfig?: BrowserStackBrowserConfig;
  private isBrowserStack: boolean;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor(options: BrowserManagerOptions) {
    this.crawlConfig = options.crawlConfig;
    this.browserstackConfig = options.browserstackConfig;
    this.targetBrowserConfig = options.targetBrowserConfig;
    this.isBrowserStack = options.isBrowserStack;
  }

  /**
   * Inicializa el navegador (local o BrowserStack)
   */
  async initialize(): Promise<BrowserInstance> {
    if (this.isBrowserStack && this.browserstackConfig && this.targetBrowserConfig) {
      return this.initializeBrowserStack();
    }
    return this.initializeLocal();
  }

  /**
   * Inicializa navegador local
   */
  private async initializeLocal(): Promise<BrowserInstance> {
    const browserType = this.getLocalBrowserType(this.crawlConfig.browsers[0]);
    const launchOptions = {
      headless: this.crawlConfig.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    };

    this.browser = await browserType.launch(launchOptions);
    this.context = await this.createContext(this.browser);

    const page = await this.context.newPage();
    await this.configurePage(page);

    return {
      browser: this.browser,
      context: this.context,
      page,
      cleanup: async () => {
        await this.context?.close();
        await this.browser?.close();
        this.browser = null;
        this.context = null;
      }
    };
  }

  /**
   * Inicializa sesión en BrowserStack
   */
  private async initializeBrowserStack(): Promise<BrowserInstance> {
    const target = resolveBrowserStackTargetFromConfig(this.targetBrowserConfig);
    const env = {
      ...process.env,
      BROWSERSTACK_USERNAME: this.browserstackConfig!.username,
      BROWSERSTACK_ACCESS_KEY: this.browserstackConfig!.accessKey
    };
    const wsEndpoint = browserStackWsEndpoint(
      target,
      {
        buildName: this.browserstackConfig!.buildName,
        sessionName: `CACHAI-QA Scan · ${target.label}`
      },
      env
    );

    // BrowserStack expone Playwright mediante su endpoint CDP; se debe usar
    // chromium.connect (no connectOverCDP) para conservar el protocolo de Playwright.
    this.browser = await chromium.connect(wsEndpoint, {
      headers: {
        'User-Agent': this.crawlConfig.userAgent || 'CACHAI-QA/1.0'
      }
    });

    this.context = await this.createContext(this.browser);
    const page = await this.context.newPage();
    await this.configurePage(page);

    return {
      browser: this.browser,
      context: this.context,
      page,
      cleanup: async () => {
        await this.context?.close();
        await this.browser?.close();
        this.browser = null;
        this.context = null;
      }
    };
  }

  /**
   * Obtiene el tipo de navegador Playwright
   */
  private getLocalBrowserType(browser: string): PWBrowserType {
    switch (browser) {
      case 'firefox': return firefox;
      case 'webkit': return webkit;
      case 'chromium':
      default: return chromium;
    }
  }

  /**
   * Crea contexto de navegador con opciones estándar
   */
  private async createContext(browser: Browser): Promise<BrowserContext> {
    const contextOptions: BrowserContextOptions = {
      viewport: this.crawlConfig.viewport,
      userAgent: this.crawlConfig.userAgent,
      locale: 'es-ES',
      timezoneId: 'America/Santiago',
      permissions: ['geolocation'],
      extraHTTPHeaders: {
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      }
    };

    const context = await browser.newContext(contextOptions);

    // Configurar timeouts por defecto
    context.setDefaultTimeout(this.crawlConfig.pageLoadTimeout);
    context.setDefaultNavigationTimeout(this.crawlConfig.pageLoadTimeout);

    return context;
  }

  /**
   * Configura página con listeners y utilidades
   */
  private async configurePage(page: Page): Promise<void> {
    // Establecer viewport
    await page.setViewportSize(this.crawlConfig.viewport);

    // Configurar user agent si se especifica
    if (this.crawlConfig.userAgent) {
      await page.setExtraHTTPHeaders({ 'User-Agent': this.crawlConfig.userAgent });
    }

    // Bloquear recursos innecesarios para acelerar
    await page.route('**/*', route => {
      const resourceType = route.request().resourceType();
      const blockedTypes = ['font', 'media', 'websocket', 'eventsource', 'manifest'];
      if (blockedTypes.includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // Manejar diálogos automáticamente
    page.on('dialog', async dialog => {
      await dialog.dismiss();
    });
  }

  /**
   * Crea una nueva página configurada
   */
  async newPage(): Promise<Page> {
    if (!this.context) {
      throw new Error('Browser context not initialized. Call initialize() first.');
    }
    const page = await this.context.newPage();
    await this.configurePage(page);
    return page;
  }

  /**
   * Navega a una URL con reintentos y espera de carga
   */
  async navigateWithRetry(page: Page, url: string, retries: number = 3): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: this.crawlConfig.pageLoadTimeout
        });

        // Esperar a que la red esté idle (opcional)
        try {
          await page.waitForLoadState('networkidle', { timeout: 10000 });
        } catch {
          // networkidle es opcional, continuamos
        }

        return {
          success: true,
          statusCode: response?.status()
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (attempt === retries) {
          return { success: false, error: errorMessage };
        }
        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, this.crawlConfig.requestDelay * attempt));
      }
    }
    return { success: false, error: 'Max retries exceeded' };
  }

  /**
   * Obtiene el navegador actual
   */
  getBrowser(): Browser | null {
    return this.browser;
  }

  /**
   * Obtiene el contexto actual
   */
  getContext(): BrowserContext | null {
    return this.context;
  }

  /**
   * Cierra todos los recursos
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Verifica si está conectado a BrowserStack
   */
  isBrowserStackSession(): boolean {
    return this.isBrowserStack;
  }
}

/**
 * Factory para crear instancias de BrowserManager
 */
export async function createBrowserManager(
  crawlConfig: CrawlConfig,
  browserstackConfig?: BrowserStackConfig,
  targetBrowserConfig?: BrowserStackBrowserConfig,
  useBrowserStack: boolean = false
): Promise<BrowserManager> {
  const manager = new BrowserManager({
    crawlConfig,
    browserstackConfig,
    targetBrowserConfig,
    isBrowserStack: useBrowserStack && !!browserstackConfig
  });

  await manager.initialize();
  return manager;
}