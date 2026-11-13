/**
 * CACHAI-QA - BrowserStack
 *
 * Centraliza lo único que el usuario debe configurar: usuario y access key.
 * El resto (proyecto, build, navegadores, capacidades y túnel local) se
 * resuelve automáticamente con valores seguros.
 */
import { BrowserStackBrowserConfig } from '../types';
declare const PROJECT_NAME = "CACHAI-QA";
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
export declare const DEFAULT_BROWSERSTACK_TARGETS: BrowserStackTarget[];
/** Devuelve las credenciales solo si están completas y no son placeholders. */
export declare function getBrowserStackCredentials(env?: NodeJS.ProcessEnv): BrowserStackCredentials | null;
export declare function hasBrowserStackCredentials(env?: NodeJS.ProcessEnv): boolean;
/** Nombre de build único y legible, sin pedir configuración adicional. */
export declare function browserStackBuildName(prefix?: string): string;
/** Identificador estable para BrowserStack Local. */
export declare function browserStackLocalIdentifier(buildName?: string): string;
export declare function browserStackDashboardUrl(buildName?: string): string;
/** Convierte un nombre local de navegador al target de BrowserStack. */
export declare function resolveBrowserStackTarget(browser: string | undefined): BrowserStackTarget;
/** Target de BrowserStack a partir de una config del CLI antiguo. */
export declare function resolveBrowserStackTargetFromConfig(config: BrowserStackBrowserConfig | undefined): BrowserStackTarget;
/**
 * Construye las capacidades públicas de una sesión. Las credenciales se
 * leen del entorno y nunca se escriben en archivos generados.
 */
export declare function buildBrowserStackCaps(target: BrowserStackTarget, options?: BrowserStackRunOptions, env?: NodeJS.ProcessEnv): Record<string, string | boolean>;
/** Endpoint WebSocket de BrowserStack para Playwright. */
export declare function browserStackWsEndpoint(target: BrowserStackTarget, options?: BrowserStackRunOptions, env?: NodeJS.ProcessEnv): string;
/** Indica si una URL solo es accesible desde la máquina local. */
export declare function isLocalTargetUrl(targetUrl: string): boolean;
/**
 * Inicia BrowserStack Local para que la nube pueda acceder a localhost o a
 * una red privada. Usa la misma access key; no requiere configuración extra.
 */
export declare function startBrowserStackLocal(buildName?: string, localIdentifier?: string): Promise<{
    identifier: string;
    stop: () => Promise<void>;
}>;
export { PROJECT_NAME as BROWSERSTACK_PROJECT_NAME };
//# sourceMappingURL=browserstack.d.ts.map