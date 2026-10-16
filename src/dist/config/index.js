"use strict";
/**
 * CACHAI-QA - Configuration Module
 * Carga y valida la configuración desde variables de entorno y archivo .env
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.getDefaultConfig = getDefaultConfig;
exports.validateLocalConfig = validateLocalConfig;
exports.ensureReportDir = ensureReportDir;
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
/**
 * Obtiene una variable de entorno con valor por defecto
 */
function getEnv(key, defaultValue = '') {
    return process.env[key] ?? defaultValue;
}
/**
 * Obtiene una variable de entorno como número
 */
function getEnvNumber(key, defaultValue) {
    const value = process.env[key];
    if (!value)
        return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}
/**
 * Obtiene una variable de entorno como booleano
 */
function getEnvBoolean(key, defaultValue) {
    const value = process.env[key];
    if (!value)
        return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
}
/**
 * Parsea lista separada por comas
 */
function parseList(value, defaultValue = []) {
    if (!value)
        return defaultValue;
    return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
}
/**
 * Parsea configuración de navegadores BrowserStack
 */
function parseBrowserStackBrowsers(value) {
    if (!value)
        return [];
    try {
        return JSON.parse(value);
    }
    catch {
        // Fallback: formato simple "chrome:Windows 10,firefox:Windows 10"
        return value.split(',').map(pair => {
            const [browser, os] = pair.split(':').map(s => s.trim());
            return { browser: browser, os };
        });
    }
}
/**
 * Normaliza una URL: antepone https:// si falta el esquema
 */
function normalizeUrl(input) {
    const trimmed = (input || '').trim();
    if (!trimmed)
        return trimmed;
    if (/^https?:\/\//i.test(trimmed))
        return trimmed;
    const host = trimmed.split('/')[0].split(':')[0].toLowerCase();
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
    return `${isLocal ? 'http' : 'https'}://${trimmed}`;
}
/**
 * Valida que la URL objetivo sea válida
 */
function validateTargetUrl(url) {
    if (!url) {
        throw new Error('TARGET_URL es obligatorio. Configúralo en .env');
    }
    try {
        new URL(url);
    }
    catch {
        throw new Error(`TARGET_URL inválida: ${url}`);
    }
}
/**
 * Valida credenciales de BrowserStack
 */
function validateBrowserStackConfig(config) {
    if (!config.username || !config.accessKey) {
        throw new Error('Credenciales de BrowserStack requeridas: BROWSERSTACK_USERNAME y BROWSERSTACK_ACCESS_KEY');
    }
    if (config.browsers.length === 0) {
        throw new Error('Debe configurar al menos un navegador en BROWSERSTACK_BROWSERS');
    }
}
/**
 * Carga la configuración completa de la aplicación
 */
function loadConfig(skipBrowserStackValidation = false) {
    // Validar URL objetivo
    const targetUrl = normalizeUrl(getEnv('TARGET_URL'));
    validateTargetUrl(targetUrl);
    const baseUrl = new URL(targetUrl);
    const defaultAllowedDomains = [baseUrl.hostname];
    // Configuración de escaneo
    const crawl = {
        targetUrl,
        crawlDepth: getEnvNumber('CRAWL_DEPTH', 10),
        maxPages: getEnvNumber('MAX_PAGES', 99999),
        pageLoadTimeout: getEnvNumber('PAGE_LOAD_TIMEOUT', 30000),
        elementWaitTimeout: getEnvNumber('ELEMENT_WAIT_TIMEOUT', 10000),
        userAgent: getEnv('USER_AGENT') || undefined,
        browsers: parseList(getEnv('BROWSERS', 'chromium,firefox')),
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
    const browserstack = {
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
    const testGeneration = {
        checkBrokenLinks: getEnvBoolean('CHECK_BROKEN_LINKS', true),
        checkImages: getEnvBoolean('CHECK_IMAGES', true),
        checkForms: getEnvBoolean('CHECK_FORMS', true),
        checkButtons: getEnvBoolean('CHECK_BUTTONS', true),
        checkConsoleErrors: getEnvBoolean('CHECK_CONSOLE_ERRORS', true),
        checkA11yBasic: getEnvBoolean('CHECK_A11Y_BASIC', true)
    };
    // Configuración de reportes
    const report = {
        reportDir: getEnv('REPORT_DIR', './reports'),
        generateHtmlReport: getEnvBoolean('GENERATE_HTML_REPORT', true),
        generateJsonReport: getEnvBoolean('GENERATE_JSON_REPORT', true)
    };
    const config = {
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
function getDefaultConfig(overrides = {}) {
    const baseConfig = loadConfig();
    return deepMerge(baseConfig, overrides);
}
/**
 * Merge profundo de objetos
 */
function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        const sourceValue = source[key];
        const targetValue = target[key];
        if (sourceValue !== null &&
            typeof sourceValue === 'object' &&
            !Array.isArray(sourceValue) &&
            targetValue !== null &&
            typeof targetValue === 'object' &&
            !Array.isArray(targetValue)) {
            result[key] = deepMerge(targetValue, sourceValue);
        }
        else if (sourceValue !== undefined) {
            result[key] = sourceValue;
        }
    }
    return result;
}
/**
 * Valida configuración para ejecución local (sin BrowserStack)
 */
function validateLocalConfig(config) {
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
function ensureReportDir(reportDir) {
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }
}
//# sourceMappingURL=index.js.map