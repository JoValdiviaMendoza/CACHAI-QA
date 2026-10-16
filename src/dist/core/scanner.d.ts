/**
 * CACHAI-QA - Page Scanner
 * Escanea páginas web y extrae enlaces, imágenes, formularios, botones, etc.
 */
import { Page } from '@playwright/test';
import { ScannedPage, ConsoleError, CrawlConfig, UrlAnalysis } from '../types';
export interface ScanResult {
    page: ScannedPage;
    newUrls: string[];
}
export declare class PageScanner {
    private config;
    private baseUrl;
    private consoleErrors;
    constructor(config: CrawlConfig);
    /**
     * Escanea una página completa y extrae todos los elementos
     */
    scanPage(page: Page, url: string): Promise<ScanResult>;
    /**
     * Configura listener para errores de consola
     */
    private setupConsoleListener;
    /**
     * Navega a la URL y espera carga
     */
    private navigateAndWait;
    /**
     * Espera a que la página esté lista para escanear
     */
    private waitForPageReady;
    /**
     * Extrae todos los enlaces de la página
     */
    private extractLinks;
    /**
     * Extrae todas las imágenes de la página
     */
    private extractImages;
    /**
     * Extrae todos los formularios de la página
     */
    private extractForms;
    /**
     * Extrae todos los botones interactivos de la página
     */
    private extractButtons;
    /**
     * Extrae metadatos de la página
     */
    private extractMetadata;
    /**
     * Verifica si una URL es interna (mismo dominio)
     */
    isInternalUrl(url: string): boolean;
    /**
     * Filtra URLs válidas para rastreo
     */
    private filterUrlsForCrawling;
    /**
     * Analiza una URL
     */
    analyzeUrl(url: string): UrlAnalysis;
    /**
     * Verifica si la URL debe ser ignorada
     */
    private shouldIgnoreUrl;
    /**
     * Verifica si el dominio está bloqueado
     */
    private isBlockedDomain;
    /**
     * Genera un selector CSS único para un elemento
     */
    private generateSelector;
    /**
     * Genera un selector CSS estable a partir de datos serializados.
     *
     * Se prefieren atributos únicos (id, name, href, src, type) antes que
     * posiciones (:nth-of-type), que son frágiles: el índice recolectado es
     * global a la página, mientras que :nth-of-type es relativo al padre, así
     * que antes producía selectores inexistentes (timeout) o ambiguos
     * (strict mode violation).
     */
    private generateSelectorFromData;
    /** Selector por id, escapando ids con caracteres no válidos en CSS. */
    private idSelector;
    /** Escapa un valor para usarlo dentro de un selector de atributo CSS. */
    private cssAttrValue;
    /** Sufijo :text-is("...") para desambiguar por texto exacto (si es seguro). */
    private textIsSuffix;
    /**
     * Verifica si un elemento es visible
     */
    private isElementVisible;
    /**
     * Obtiene errores de consola capturados
     */
    getConsoleErrors(): ConsoleError[];
    /**
     * Limpia errores capturados
     */
    clearConsoleErrors(): void;
}
/**
 * Crea una instancia del scanner
 */
export declare function createPageScanner(config: CrawlConfig): PageScanner;
//# sourceMappingURL=scanner.d.ts.map