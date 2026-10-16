/**
 * CACHAI-QA - Configuration Module
 * Carga y valida la configuración desde variables de entorno y archivo .env
 */
import { AppConfig, CrawlConfig, BrowserStackConfig, TestGenerationConfig, ReportConfig } from '../types';
/**
 * Carga la configuración completa de la aplicación
 */
export declare function loadConfig(skipBrowserStackValidation?: boolean): AppConfig;
/**
 * Configuración por defecto (para testing o CLI overrides)
 */
export declare function getDefaultConfig(overrides?: Partial<AppConfig>): AppConfig;
/**
 * Valida configuración para ejecución local (sin BrowserStack)
 */
export declare function validateLocalConfig(config: AppConfig): void;
/**
 * Crea directorio de reportes si no existe
 */
export declare function ensureReportDir(reportDir: string): void;
export { AppConfig, CrawlConfig, BrowserStackConfig, TestGenerationConfig, ReportConfig };
//# sourceMappingURL=index.d.ts.map