/**
 * CACHAI-QA - Browser Manager
 * Wrapper de Playwright para gestión de navegadores (local y BrowserStack)
 */
import { Browser, BrowserContext, Page } from '@playwright/test';
import { BrowserStackConfig, BrowserStackBrowserConfig, CrawlConfig } from '../types';
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
export declare class BrowserManager {
    private crawlConfig;
    private browserstackConfig?;
    private targetBrowserConfig?;
    private isBrowserStack;
    private browser;
    private context;
    constructor(options: BrowserManagerOptions);
    /**
     * Inicializa el navegador (local o BrowserStack)
     */
    initialize(): Promise<BrowserInstance>;
    /**
     * Inicializa navegador local
     */
    private initializeLocal;
    /**
     * Inicializa sesión en BrowserStack
     */
    private initializeBrowserStack;
    /**
     * Construye capabilities para BrowserStack
     */
    private buildBrowserStackCapabilities;
    /**
     * Obtiene el tipo de navegador Playwright
     */
    private getLocalBrowserType;
    /**
     * Crea contexto de navegador con opciones estándar
     */
    private createContext;
    /**
     * Configura página con listeners y utilidades
     */
    private configurePage;
    /**
     * Crea una nueva página configurada
     */
    newPage(): Promise<Page>;
    /**
     * Navega a una URL con reintentos y espera de carga
     */
    navigateWithRetry(page: Page, url: string, retries?: number): Promise<{
        success: boolean;
        statusCode?: number;
        error?: string;
    }>;
    /**
     * Obtiene el navegador actual
     */
    getBrowser(): Browser | null;
    /**
     * Obtiene el contexto actual
     */
    getContext(): BrowserContext | null;
    /**
     * Cierra todos los recursos
     */
    close(): Promise<void>;
    /**
     * Verifica si está conectado a BrowserStack
     */
    isBrowserStackSession(): boolean;
}
/**
 * Factory para crear instancias de BrowserManager
 */
export declare function createBrowserManager(crawlConfig: CrawlConfig, browserstackConfig?: BrowserStackConfig, targetBrowserConfig?: BrowserStackBrowserConfig, useBrowserStack?: boolean): Promise<BrowserManager>;
//# sourceMappingURL=browser.d.ts.map