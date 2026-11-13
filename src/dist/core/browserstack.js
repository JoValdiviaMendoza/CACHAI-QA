"use strict";
/**
 * CACHAI-QA - BrowserStack
 *
 * Centraliza lo único que el usuario debe configurar: usuario y access key.
 * El resto (proyecto, build, navegadores, capacidades y túnel local) se
 * resuelve automáticamente con valores seguros.
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
exports.BROWSERSTACK_PROJECT_NAME = exports.DEFAULT_BROWSERSTACK_TARGETS = void 0;
exports.getBrowserStackCredentials = getBrowserStackCredentials;
exports.hasBrowserStackCredentials = hasBrowserStackCredentials;
exports.browserStackBuildName = browserStackBuildName;
exports.browserStackLocalIdentifier = browserStackLocalIdentifier;
exports.browserStackDashboardUrl = browserStackDashboardUrl;
exports.resolveBrowserStackTarget = resolveBrowserStackTarget;
exports.resolveBrowserStackTargetFromConfig = resolveBrowserStackTargetFromConfig;
exports.buildBrowserStackCaps = buildBrowserStackCaps;
exports.browserStackWsEndpoint = browserStackWsEndpoint;
exports.isLocalTargetUrl = isLocalTargetUrl;
exports.startBrowserStackLocal = startBrowserStackLocal;
const os = __importStar(require("os"));
const BROWSERSTACK_ENDPOINT = 'wss://cdp.browserstack.com/playwright';
const PROJECT_NAME = 'CACHAI-QA';
exports.BROWSERSTACK_PROJECT_NAME = PROJECT_NAME;
/**
 * Navegadores por defecto. No requiere configuración adicional: Chrome,
 * Firefox y WebKit/Safari en las versiones estables de BrowserStack.
 */
exports.DEFAULT_BROWSERSTACK_TARGETS = [
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
function clean(value) {
    return String(value || '').trim();
}
function isPlaceholder(value) {
    const normalized = value.toLowerCase();
    return (normalized === '' ||
        normalized === 'tu_usuario_browserstack' ||
        normalized === 'tu_access_key_browserstack' ||
        normalized === 'your_username' ||
        normalized === 'your_access_key' ||
        normalized === 'username' ||
        normalized === 'access_key');
}
/** Devuelve las credenciales solo si están completas y no son placeholders. */
function getBrowserStackCredentials(env = process.env) {
    const username = clean(env.BROWSERSTACK_USERNAME);
    const accessKey = clean(env.BROWSERSTACK_ACCESS_KEY);
    if (isPlaceholder(username) || isPlaceholder(accessKey))
        return null;
    return { username, accessKey };
}
function hasBrowserStackCredentials(env = process.env) {
    return getBrowserStackCredentials(env) !== null;
}
/** Nombre de build único y legible, sin pedir configuración adicional. */
function browserStackBuildName(prefix = 'cachai-qa') {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
/** Identificador estable para BrowserStack Local. */
function browserStackLocalIdentifier(buildName) {
    const host = os.hostname().replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    return `cachai-qa-${host}-${buildName || browserStackBuildName()}`.slice(0, 80);
}
function browserStackDashboardUrl(buildName) {
    const base = 'https://automate.browserstack.com/dashboard/v2/builds';
    if (!buildName)
        return base;
    return `${base}?search=${encodeURIComponent(buildName)}`;
}
/** Convierte un nombre local de navegador al target de BrowserStack. */
function resolveBrowserStackTarget(browser) {
    const key = clean(browser).toLowerCase();
    if (key === 'firefox')
        return exports.DEFAULT_BROWSERSTACK_TARGETS[1];
    if (key === 'webkit' || key === 'safari')
        return exports.DEFAULT_BROWSERSTACK_TARGETS[2];
    if (key === 'edge' || key === 'msedge')
        return exports.DEFAULT_BROWSERSTACK_TARGETS[3];
    return exports.DEFAULT_BROWSERSTACK_TARGETS[0];
}
/** Target de BrowserStack a partir de una config del CLI antiguo. */
function resolveBrowserStackTargetFromConfig(config) {
    if (!config)
        return exports.DEFAULT_BROWSERSTACK_TARGETS[0];
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
    if (browser === 'firefox' || browser === 'playwright-firefox')
        return exports.DEFAULT_BROWSERSTACK_TARGETS[1];
    if (browser === 'safari' || browser === 'webkit' || browser === 'playwright-webkit') {
        return exports.DEFAULT_BROWSERSTACK_TARGETS[2];
    }
    if (browser === 'edge')
        return exports.DEFAULT_BROWSERSTACK_TARGETS[3];
    return {
        ...exports.DEFAULT_BROWSERSTACK_TARGETS[0],
        os: config.os || exports.DEFAULT_BROWSERSTACK_TARGETS[0].os,
        os_version: config.os_version || exports.DEFAULT_BROWSERSTACK_TARGETS[0].os_version
    };
}
/**
 * Construye las capacidades públicas de una sesión. Las credenciales se
 * leen del entorno y nunca se escriben en archivos generados.
 */
function buildBrowserStackCaps(target, options = {}, env = process.env) {
    const credentials = getBrowserStackCredentials(env);
    if (!credentials) {
        throw new Error('BrowserStack requiere BROWSERSTACK_USERNAME y BROWSERSTACK_ACCESS_KEY en src/.env.');
    }
    const caps = {
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
    if (target.browser_version)
        caps.browser_version = target.browser_version;
    if (options.local) {
        caps['browserstack.localIdentifier'] =
            options.localIdentifier || browserStackLocalIdentifier(options.buildName);
    }
    return caps;
}
/** Endpoint WebSocket de BrowserStack para Playwright. */
function browserStackWsEndpoint(target, options = {}, env = process.env) {
    const caps = buildBrowserStackCaps(target, options, env);
    return `${BROWSERSTACK_ENDPOINT}?caps=${encodeURIComponent(JSON.stringify(caps))}`;
}
/** Indica si una URL solo es accesible desde la máquina local. */
function isLocalTargetUrl(targetUrl) {
    try {
        const host = new URL(targetUrl).hostname.toLowerCase();
        if (host === 'localhost' ||
            host === '127.0.0.1' ||
            host === '::1' ||
            host === '0.0.0.0' ||
            host.endsWith('.local')) {
            return true;
        }
        if (/^10\./.test(host))
            return true;
        if (/^192\.168\./.test(host))
            return true;
        if (/^169\.254\./.test(host))
            return true;
        const private172 = /^172\.(\d{1,3})\./.exec(host);
        if (private172) {
            const octet = Number(private172[1]);
            if (octet >= 16 && octet <= 31)
                return true;
        }
        return false;
    }
    catch {
        return false;
    }
}
/**
 * Inicia BrowserStack Local para que la nube pueda acceder a localhost o a
 * una red privada. Usa la misma access key; no requiere configuración extra.
 */
async function startBrowserStackLocal(buildName, localIdentifier) {
    const credentials = getBrowserStackCredentials();
    if (!credentials) {
        throw new Error('BrowserStack Local requiere BROWSERSTACK_USERNAME y BROWSERSTACK_ACCESS_KEY.');
    }
    // Se carga de forma perezosa para que el resto del framework funcione
    // aunque BrowserStack Local no esté instalado.
    let BrowserStackLocal;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        BrowserStackLocal = require('browserstack-local');
    }
    catch {
        throw new Error('Falta la dependencia browserstack-local. Ejecuta la opción [8] del menú para instalar dependencias.');
    }
    const identifier = localIdentifier || browserStackLocalIdentifier(buildName);
    const tunnel = new BrowserStackLocal.Local();
    await new Promise((resolve, reject) => {
        tunnel.start({
            key: credentials.accessKey,
            forceLocal: true,
            onlyAutomate: true,
            localIdentifier: identifier
        }, (error) => {
            if (error)
                reject(error);
            else
                resolve();
        });
    });
    return {
        identifier,
        stop: () => new Promise((resolve) => {
            try {
                if (typeof tunnel.isRunning === 'function' && !tunnel.isRunning()) {
                    resolve();
                    return;
                }
                tunnel.stop(() => resolve());
            }
            catch {
                resolve();
            }
        })
    };
}
//# sourceMappingURL=browserstack.js.map