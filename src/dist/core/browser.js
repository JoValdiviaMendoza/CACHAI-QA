"use strict";
/**
 * CACHAI-QA - Browser Manager
 * Wrapper de Playwright para gestión de navegadores (local y BrowserStack)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserManager = void 0;
exports.createBrowserManager = createBrowserManager;
const test_1 = require("@playwright/test");
class BrowserManager {
    crawlConfig;
    browserstackConfig;
    targetBrowserConfig;
    isBrowserStack;
    browser = null;
    context = null;
    constructor(options) {
        this.crawlConfig = options.crawlConfig;
        this.browserstackConfig = options.browserstackConfig;
        this.targetBrowserConfig = options.targetBrowserConfig;
        this.isBrowserStack = options.isBrowserStack;
    }
    /**
     * Inicializa el navegador (local o BrowserStack)
     */
    async initialize() {
        if (this.isBrowserStack && this.browserstackConfig && this.targetBrowserConfig) {
            return this.initializeBrowserStack();
        }
        return this.initializeLocal();
    }
    /**
     * Inicializa navegador local
     */
    async initializeLocal() {
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
    async initializeBrowserStack() {
        const { username, accessKey } = this.browserstackConfig;
        const caps = this.buildBrowserStackCapabilities();
        const wsEndpoint = `wss://${username}:${accessKey}@hub-cloud.browserstack.com/playwright/${caps}`;
        this.browser = await test_1.chromium.connectOverCDP(wsEndpoint, {
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
     * Construye capabilities para BrowserStack
     */
    buildBrowserStackCapabilities() {
        const { projectName, buildName, sessionTimeout, video, networkLogs, consoleLogs } = this.browserstackConfig;
        const browserConfig = this.targetBrowserConfig;
        const caps = {
            'browserstack.username': this.browserstackConfig.username,
            'browserstack.accessKey': this.browserstackConfig.accessKey,
            project: projectName,
            build: buildName,
            name: `CACHAI-QA Scan - ${new Date().toISOString()}`,
            'browserstack.debug': true,
            'browserstack.video': video,
            'browserstack.networkLogs': networkLogs,
            'browserstack.console': consoleLogs ? 'errors' : 'disable',
            'browserstack.sessionTimeout': sessionTimeout,
            'browserstack.local': false
        };
        // Configuración de navegador/SO
        if (browserConfig.device) {
            caps.device = browserConfig.device;
            caps.realMobile = browserConfig.real_mobile || false;
        }
        else {
            caps.browser = browserConfig.browser;
            if (browserConfig.browser_version)
                caps.browser_version = browserConfig.browser_version;
            caps.os = browserConfig.os;
            if (browserConfig.os_version)
                caps.os_version = browserConfig.os_version;
        }
        // Viewport
        caps.resolution = `${this.crawlConfig.viewport.width}x${this.crawlConfig.viewport.height}`;
        return encodeURIComponent(JSON.stringify(caps));
    }
    /**
     * Obtiene el tipo de navegador Playwright
     */
    getLocalBrowserType(browser) {
        switch (browser) {
            case 'firefox': return test_1.firefox;
            case 'webkit': return test_1.webkit;
            case 'chromium':
            default: return test_1.chromium;
        }
    }
    /**
     * Crea contexto de navegador con opciones estándar
     */
    async createContext(browser) {
        const contextOptions = {
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
    async configurePage(page) {
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
            }
            else {
                route.continue();
            }
        });
        // Manejar diálogos automáticamente
        page.on('dialog', async (dialog) => {
            await dialog.dismiss();
        });
    }
    /**
     * Crea una nueva página configurada
     */
    async newPage() {
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
    async navigateWithRetry(page, url, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: this.crawlConfig.pageLoadTimeout
                });
                // Esperar a que la red esté idle (opcional)
                try {
                    await page.waitForLoadState('networkidle', { timeout: 10000 });
                }
                catch {
                    // networkidle es opcional, continuamos
                }
                return {
                    success: true,
                    statusCode: response?.status()
                };
            }
            catch (error) {
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
    getBrowser() {
        return this.browser;
    }
    /**
     * Obtiene el contexto actual
     */
    getContext() {
        return this.context;
    }
    /**
     * Cierra todos los recursos
     */
    async close() {
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
    isBrowserStackSession() {
        return this.isBrowserStack;
    }
}
exports.BrowserManager = BrowserManager;
/**
 * Factory para crear instancias de BrowserManager
 */
async function createBrowserManager(crawlConfig, browserstackConfig, targetBrowserConfig, useBrowserStack = false) {
    const manager = new BrowserManager({
        crawlConfig,
        browserstackConfig,
        targetBrowserConfig,
        isBrowserStack: useBrowserStack && !!browserstackConfig
    });
    await manager.initialize();
    return manager;
}
//# sourceMappingURL=browser.js.map