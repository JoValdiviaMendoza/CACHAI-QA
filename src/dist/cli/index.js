#!/usr/bin/env node
"use strict";
/**
 * CACHAI-QA - CLI Principal
 * Orquesta: Config → Escaneo → Generación Tests → Ejecución (Local/BrowserStack) → Reportes
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const inquirer_1 = __importDefault(require("inquirer"));
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const config_1 = require("../config");
const browser_1 = require("../core/browser");
const scanner_1 = require("../core/scanner");
const generator_1 = require("../core/generator");
async function main() {
    const argv = await (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .scriptName('cachai-qa')
        .usage('$0 [opciones]')
        .option('url', { alias: 'u', type: 'string', describe: 'URL a escanear' })
        .option('local', { type: 'boolean', describe: 'Ejecutar local' })
        .option('browserstack', { alias: 'bs', type: 'boolean', describe: 'Ejecutar en BrowserStack' })
        .option('depth', { alias: 'd', type: 'number', describe: 'Profundidad de rastreo' })
        .option('max-pages', { alias: 'm', type: 'number', describe: 'Máximo páginas' })
        .option('concurrency', { alias: 'c', type: 'number', describe: 'Páginas escaneadas en paralelo' })
        .option('headless', { type: 'boolean', describe: 'Modo headless' })
        .option('browsers', { type: 'string', describe: 'Navegadores separados por coma (ej: chromium,firefox)' })
        .option('verbose', { alias: 'v', type: 'boolean', default: false })
        .option('dry-run', { type: 'boolean', default: false })
        .option('generate-only', { alias: 'g', type: 'boolean', default: false })
        .option('output', { alias: 'o', type: 'string' })
        .help().alias('help', 'h').version().alias('version', 'V').parse();
    showBanner();
    const needsInteractive = !argv.url || (!argv.local && !argv.browserstack);
    let options = {
        url: argv.url,
        local: argv.local || false,
        browserstack: argv.browserstack || false,
        depth: argv.depth,
        maxPages: argv['max-pages'],
        headless: argv.headless,
        browsers: argv.browsers,
        verbose: argv.verbose || false,
        dryRun: argv['dry-run'] || false,
        generateOnly: argv['generate-only'] || false,
        output: argv.output,
        concurrency: argv.concurrency
    };
    if (needsInteractive) {
        const answers = await runInteractiveMode();
        options = { ...options, ...answers };
    }
    if (options.url) {
        options.url = normalizeUrl(options.url);
    }
    if (!options.url) {
        console.error(chalk_1.default.red('❌ URL requerida'));
        process.exit(1);
    }
    if (!options.local && !options.browserstack) {
        console.error(chalk_1.default.red('❌ Debe especificar modo: --local o --browserstack'));
        process.exit(1);
    }
    const spinner = (0, ora_1.default)('Iniciando CACHAI-QA...').start();
    let context;
    try {
        const config = loadConfigWithOverrides(options);
        if (options.local) {
            (0, config_1.validateLocalConfig)(config);
        }
        context = {
            config,
            options,
            spinner,
            scannedPages: []
        };
        await runPipeline(context);
        spinner.succeed(chalk_1.default.green('✅ CACHAI-QA completado exitosamente'));
    }
    catch (error) {
        spinner.fail(chalk_1.default.red('❌ Error en CACHAI-QA'));
        console.error(chalk_1.default.red(error instanceof Error ? error.message : String(error)));
        if (options.verbose && error instanceof Error) {
            console.error(error.stack);
        }
        process.exitCode = 1;
    }
    finally {
        try {
            await context?.browserManager?.close();
        }
        catch {
            // Ignorar errores al cerrar el navegador
        }
    }
}
function showBanner() {
    console.log(chalk_1.default.bold.cyan('\n╔══════════════════════════════════════════════════════════╗'));
    console.log(chalk_1.default.bold.cyan('║                    🎯 CACHAI-QA v1.0.0                    ║'));
    console.log(chalk_1.default.bold.cyan('║         Comprehensive Automated Checks & Headless         ║'));
    console.log(chalk_1.default.bold.cyan('║              Assertions Infrastructure - DUOC             ║'));
    console.log(chalk_1.default.bold.cyan('╚══════════════════════════════════════════════════════════╝\n'));
}
/**
 * Normaliza una URL: si no trae esquema, antepone https://
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
 * Devuelve un slug de fecha/hora: YYYYMMDD-HHMMSS
 */
function timestampSlug(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
/**
 * Extrae el hostname (sin www) de una URL, para nombrar archivos
 */
function hostnameOf(url) {
    try {
        return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '') || 'sitio';
    }
    catch {
        return 'sitio';
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function runInteractiveMode() {
    console.log(chalk_1.default.yellow('🚀 Modo Interactivo Activado\n'));
    const { url } = await inquirer_1.default.prompt([
        {
            type: 'input',
            name: 'url',
            message: '🔗 Ingresa la URL a escanear:',
            validate: (input) => {
                if (!input.trim())
                    return 'URL es requerida';
                try {
                    new URL(normalizeUrl(input));
                    return true;
                }
                catch {
                    return 'URL inválida';
                }
            }
        }
    ]);
    const { mode } = await inquirer_1.default.prompt([
        {
            type: 'select',
            name: 'mode',
            message: '🖥️  Selecciona modo de ejecución:',
            choices: [
                { name: '💻 Local (Playwright - navegador local)', value: 'local' },
                { name: '☁️  BrowserStack (Nube - Chrome + Firefox)', value: 'browserstack' }
            ],
            default: 'local'
        }
    ]);
    const { advanced } = await inquirer_1.default.prompt([
        {
            type: 'confirm',
            name: 'advanced',
            message: '⚙️  ¿Configurar opciones avanzadas?',
            default: false
        }
    ]);
    let depth = 1;
    let maxPages = 50;
    let headless = true;
    let dryRun = false;
    let generateOnly = false;
    let verbose = false;
    if (advanced) {
        const adv = await inquirer_1.default.prompt([
            {
                type: 'number',
                name: 'depth',
                message: '📏 Profundidad de rastreo (0=solo URL, 1=enlaces directos, 2=profundo):',
                default: 1,
                validate: (n) => n >= 0 && n <= 5 || 'Entre 0 y 5'
            },
            {
                type: 'number',
                name: 'maxPages',
                message: '📄 Máximo de páginas a escanear:',
                default: 50,
                validate: (n) => n > 0 && n <= 500 || 'Entre 1 y 500'
            },
            {
                type: 'confirm',
                name: 'headless',
                message: '👻 Modo headless (invisible):',
                default: true
            },
            {
                type: 'confirm',
                name: 'dryRun',
                message: '🧪 Solo escanear y generar tests (no ejecutar):',
                default: false
            },
            {
                type: 'confirm',
                name: 'verbose',
                message: '📝 Logs detallados:',
                default: false
            }
        ]);
        depth = adv.depth;
        maxPages = adv.maxPages;
        headless = adv.headless;
        dryRun = adv.dryRun;
        verbose = adv.verbose;
        generateOnly = dryRun;
    }
    return {
        url: normalizeUrl(url),
        mode,
        local: mode === 'local',
        browserstack: mode === 'browserstack',
        depth,
        maxPages,
        headless,
        dryRun,
        generateOnly,
        verbose
    };
}
async function promptForUrl() {
    const readline = await Promise.resolve().then(() => __importStar(require('readline')));
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    console.log(chalk_1.default.bold.cyan('\n🎯 CACHAI-QA - Modo Interactivo'));
    console.log(chalk_1.default.gray('─'.repeat(50)));
    console.log(chalk_1.default.white('Ingresa la URL de la página web a escanear:'));
    console.log(chalk_1.default.gray('  Ejemplos: https://miweb.com  |  https://ejemplo.com/path'));
    console.log(chalk_1.default.gray('─'.repeat(50)));
    return new Promise((resolve) => {
        rl.question(chalk_1.default.yellow('🔗 URL: '), (answer) => {
            rl.close();
            const url = answer.trim();
            if (!url) {
                resolve(null);
                return;
            }
            try {
                resolve(new URL(normalizeUrl(url)).toString());
            }
            catch {
                console.error(chalk_1.default.red('❌ URL inválida'));
                resolve(null);
            }
        });
    });
}
function loadConfigWithOverrides(options) {
    const config = (0, config_1.loadConfig)(options.local === true);
    if (options.url)
        config.crawl.targetUrl = normalizeUrl(options.url);
    if (options.depth !== undefined)
        config.crawl.crawlDepth = options.depth;
    if (options.maxPages !== undefined)
        config.crawl.maxPages = options.maxPages;
    if (options.headless !== undefined)
        config.crawl.headless = options.headless;
    if (options.browsers)
        config.crawl.browsers = options.browsers.split(',');
    if (options.output)
        config.report.reportDir = options.output;
    if (options.concurrency !== undefined)
        config.crawl.maxConcurrency = options.concurrency;
    return config;
}
async function runPipeline(context) {
    const { config, options, spinner } = context;
    spinner.text = '🌐 Inicializando navegador...';
    context.browserManager = await (0, browser_1.createBrowserManager)(config.crawl, options.browserstack ? config.browserstack : undefined, options.browserstack ? config.browserstack.browsers[0] : undefined, options.browserstack);
    spinner.text = '🔍 Escaneando páginas...';
    context.scannedPages = await scanPages(context);
    if (context.scannedPages.length === 0) {
        throw new Error('No se escaneó ninguna página');
    }
    spinner.info(chalk_1.default.cyan(`📄 ${context.scannedPages.length} páginas escaneadas`));
    spinner.text = '🧪 Generando tests automáticos...';
    const generator = new generator_1.TestGenerator(config.testGeneration);
    context.testSuite = generator.generateTestSuite(context.scannedPages, config.crawl.targetUrl);
    spinner.info(chalk_1.default.cyan(`📝 ${context.testSuite.tests.length} tests generados`));
    if (options.generateOnly || options.dryRun || options.output) {
        const outputDir = options.output || config.report.reportDir;
        (0, config_1.ensureReportDir)(outputDir);
        const testFile = path.join(outputDir, `cachai-generated-${Date.now()}.spec.ts`);
        fs.writeFileSync(testFile, (0, generator_1.exportToPlaywrightTest)(context.testSuite));
        spinner.info(chalk_1.default.cyan(`📄 Tests exportados a: ${testFile}`));
    }
    if (options.dryRun || options.generateOnly) {
        spinner.info(chalk_1.default.yellow('⏭️  Dry-run / generate-only: saltando ejecución'));
        return;
    }
    spinner.text = '▶️  Ejecutando tests...';
    await runTests(context);
    spinner.text = '📊 Generando reporte final...';
    await generateFinalReport(context);
    printSummary(context);
}
async function scanPages(context) {
    const { config, options, browserManager, spinner } = context;
    const scanner = (0, scanner_1.createPageScanner)(config.crawl);
    const pages = [];
    const queue = [{ url: config.crawl.targetUrl, depth: 0 }];
    const visited = new Set();
    const enqueued = new Set([config.crawl.targetUrl]);
    const concurrency = Math.max(1, config.crawl.maxConcurrency);
    let pageCount = 0;
    let active = 0;
    let cancelled = false;
    let limitReached = false;
    // Handle Ctrl+C
    const handleInterrupt = () => {
        cancelled = true;
        console.log('\n⚠️  Cancelando escaneo...');
    };
    process.on('SIGINT', handleInterrupt);
    // Worker: consume la cola hasta agotarla (permite N páginas en paralelo)
    const worker = async () => {
        while (!cancelled) {
            if (pageCount >= config.crawl.maxPages) {
                limitReached = true;
                return;
            }
            const item = queue.shift();
            if (!item) {
                // Cola vacía: si otro worker sigue procesando, esperar por más URLs
                if (active === 0)
                    return;
                await sleep(50);
                continue;
            }
            if (visited.has(item.url))
                continue;
            if (item.depth > config.crawl.crawlDepth)
                continue;
            visited.add(item.url);
            pageCount++;
            active++;
            const { url, depth } = item;
            if (options.verbose) {
                spinner.text = `🔍 Escaneando (${pageCount}) [depth ${depth}]: ${url}`;
            }
            else {
                spinner.text = `🔍 Escaneando: ${url}`;
            }
            try {
                const page = await browserManager.newPage();
                const result = await scanner.scanPage(page, url);
                await page.close();
                pages.push(result.page);
                // Show discovered URLs in real-time
                if (options.verbose && result.newUrls.length > 0) {
                    console.log(chalk_1.default.gray(`   ↳ ${result.newUrls.length} nuevos enlaces descubiertos`));
                }
                for (const newUrl of result.newUrls) {
                    if (!visited.has(newUrl) && !enqueued.has(newUrl) && depth < config.crawl.crawlDepth) {
                        enqueued.add(newUrl);
                        queue.push({ url: newUrl, depth: depth + 1 });
                    }
                }
                if (config.crawl.requestDelay > 0 && !cancelled) {
                    await sleep(config.crawl.requestDelay);
                }
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                if (options.verbose) {
                    spinner.warn(chalk_1.default.yellow(`⚠️ Error en ${url}: ${msg}`));
                }
            }
            finally {
                active--;
            }
        }
    };
    try {
        await Promise.all(Array.from({ length: concurrency }, () => worker()));
        if (limitReached && !cancelled) {
            console.log(chalk_1.default.yellow(`\n⚠️  Límite de ${config.crawl.maxPages} páginas alcanzado.`));
        }
        else if (cancelled) {
            console.log(chalk_1.default.yellow(`\n⚠️  Escaneo cancelado por el usuario. Páginas escaneadas: ${pageCount}`));
        }
    }
    finally {
        process.off('SIGINT', handleInterrupt);
    }
    return pages;
}
async function runTests(context) {
    const { config, options, testSuite, browserManager } = context;
    if (!testSuite || !browserManager)
        return;
    if (options.browserstack) {
        await runOnBrowserStack(context);
    }
    else {
        await runLocalTests(context);
    }
}
async function runLocalTests(context) {
    const { config, options, testSuite, spinner } = context;
    const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
    const testDir = path.join(config.report.reportDir, 'generated-tests');
    (0, config_1.ensureReportDir)(testDir);
    const testFile = path.join(testDir, `cachai-tests.spec.ts`);
    fs.writeFileSync(testFile, (0, generator_1.exportToPlaywrightTest)(testSuite));
    const reportDir = config.report.reportDir;
    const reportDirNormalized = path.resolve(reportDir).replace(/\\/g, '/');
    const reportFolderName = `playwright-report-${timestampSlug()}`;
    context.reportFolder = path.join(reportDir, reportFolderName);
    const pwConfig = 'import { defineConfig } from \'@playwright/test\';\n' +
        'export default defineConfig({\n' +
        '  testDir: \'.\',\n' +
        '  testMatch: \'cachai-tests.spec.ts\',\n' +
        '  timeout: ' + config.crawl.pageLoadTimeout + ',\n' +
        '  retries: ' + config.crawl.retryCount + ',\n' +
        '  fullyParallel: true,\n' +
        '  workers: ' + Math.max(1, config.crawl.maxConcurrency) + ',\n' +
        '  use: {\n' +
        '    headless: ' + config.crawl.headless + ',\n' +
        '    viewport: { width: ' + config.crawl.viewport.width + ', height: ' + config.crawl.viewport.height + ' },\n' +
        '    trace: \'on-first-retry\',\n' +
        '    screenshot: \'only-on-failure\',\n' +
        '    video: \'retain-on-failure\'\n' +
        '  },\n' +
        '  projects: ' + JSON.stringify(config.crawl.browsers.map((b) => ({ name: b, use: { browserName: b } }))) + ',\n' +
        '  reporter: [[\'html\', { outputFolder: \'' + reportDirNormalized + '/' + reportFolderName + '\', open: \'never\' }], [\'json\', { outputFile: \'' + reportDirNormalized + '/results.json\' }]]\n' +
        '});\n';
    const configFile = path.join(testDir, 'playwright.config.ts');
    fs.writeFileSync(configFile, pwConfig);
    spinner.text = '▶️  Ejecutando tests localmente...';
    try {
        // Run from testDir, config file is just the filename
        execSync(`npx playwright test --config=playwright.config.ts`, {
            cwd: testDir,
            stdio: options.verbose ? 'inherit' : 'pipe',
            env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' }
        });
        spinner.succeed('Tests locales completados');
    }
    catch (error) {
        spinner.warn('Tests completados (algunos pueden haber fallado - ver reporte)');
    }
}
async function runOnBrowserStack(context) {
    const { config, options, testSuite, spinner } = context;
    const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
    const testDir = path.join(config.report.reportDir, 'generated-tests');
    (0, config_1.ensureReportDir)(testDir);
    const testFile = path.join(testDir, `cachai-tests.spec.ts`);
    fs.writeFileSync(testFile, (0, generator_1.exportToPlaywrightTest)(testSuite));
    const reportDir = config.report.reportDir;
    const reportDirNormalized = path.resolve(reportDir).replace(/\\/g, '/');
    const reportFolderName = `playwright-report-${timestampSlug()}`;
    context.reportFolder = path.join(reportDir, reportFolderName);
    const bsConfig = 'import { defineConfig, devices } from \'@playwright/test\';\n' +
        'export default defineConfig({\n' +
        '  testDir: \'.\',\n' +
        '  testMatch: \'cachai-tests.spec.ts\',\n' +
        '  timeout: ' + (config.browserstack.sessionTimeout * 1000) + ',\n' +
        '  retries: ' + config.crawl.retryCount + ',\n' +
        '  fullyParallel: true,\n' +
        '  use: { trace: \'on-first-retry\' },\n' +
        '  projects: ' + JSON.stringify(config.browserstack.browsers.map((b, i) => ({
        name: 'bs-' + b.browser + '-' + b.os,
        use: {
            browserName: b.browser === 'chrome' ? 'chromium' : b.browser === 'firefox' ? 'firefox' : 'webkit',
            viewport: { width: config.crawl.viewport.width, height: config.crawl.viewport.height },
        },
    }))) + ',\n' +
        '  reporter: [[\'html\', { outputFolder: \'' + reportDirNormalized + '/' + reportFolderName + '\', open: \'never\' }], [\'json\', { outputFile: \'' + reportDirNormalized + '/results.json\' }]]\n' +
        '});\n';
    const configFile = path.join(testDir, 'playwright.config.ts');
    fs.writeFileSync(configFile, bsConfig);
    spinner.text = '☁️  Ejecutando en BrowserStack...';
    const env = {
        ...process.env,
        BROWSERSTACK_USERNAME: config.browserstack.username,
        BROWSERSTACK_ACCESS_KEY: config.browserstack.accessKey,
        BROWSERSTACK_PROJECT_NAME: config.browserstack.projectName,
        BROWSERSTACK_BUILD_NAME: config.browserstack.buildName,
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1'
    };
    try {
        execSync(`npx playwright test --config="${configFile}"`, {
            cwd: process.cwd(),
            stdio: options.verbose ? 'inherit' : 'pipe',
            env
        });
        spinner.succeed('Tests en BrowserStack completados');
    }
    catch (error) {
        spinner.warn('Tests completados (ver reporte en BrowserStack Dashboard)');
    }
}
async function generateFinalReport(context) {
    const { config, scannedPages, testSuite } = context;
    if (!config.report.generateJsonReport && !config.report.generateHtmlReport)
        return;
    (0, config_1.ensureReportDir)(config.report.reportDir);
    if (config.report.generateJsonReport) {
        const report = {
            metadata: {
                timestamp: new Date().toISOString(),
                targetUrl: config.crawl.targetUrl,
                mode: context.options.browserstack ? 'browserstack' : 'local',
                pagesScanned: scannedPages.length,
                testsGenerated: testSuite?.tests.length || 0,
                config: {
                    depth: config.crawl.crawlDepth,
                    maxPages: config.crawl.maxPages,
                    browsers: config.crawl.browsers
                }
            },
            pages: scannedPages.map(p => ({
                url: p.url,
                title: p.title,
                statusCode: p.statusCode,
                loadTime: p.loadTime,
                linksCount: p.links.length,
                imagesCount: p.images.length,
                formsCount: p.forms.length,
                buttonsCount: p.buttons.length,
                consoleErrorsCount: p.consoleErrors.length
            })),
            testSuite: testSuite ? {
                name: testSuite.name,
                tests: testSuite.tests.map(t => ({
                    id: t.id,
                    name: t.name,
                    type: t.type,
                    priority: t.priority
                }))
            } : null
        };
        const reportFileName = `${hostnameOf(config.crawl.targetUrl)}-${timestampSlug()}.json`;
        fs.writeFileSync(path.join(config.report.reportDir, reportFileName), JSON.stringify(report, null, 2));
        console.log(chalk_1.default.gray(`📄 Reporte JSON: ${path.join(config.report.reportDir, reportFileName)}`));
    }
}
function printSummary(context) {
    const { config, scannedPages, testSuite, options } = context;
    console.log('\n' + chalk_1.default.bold('='.repeat(60)));
    console.log(chalk_1.default.bold('📋 RESUMEN CACHAI-QA'));
    console.log(chalk_1.default.bold('='.repeat(60)));
    console.log(chalk_1.default.cyan(`URL objetivo:    ${config.crawl.targetUrl}`));
    console.log(chalk_1.default.cyan(`Modo:            ${options.browserstack ? 'BrowserStack ☁️' : 'Local 💻'}`));
    console.log(chalk_1.default.cyan(`Páginas escaneadas: ${scannedPages.length}`));
    if (testSuite) {
        const byType = testSuite.tests.reduce((acc, t) => {
            acc[t.type] = (acc[t.type] || 0) + 1;
            return acc;
        }, {});
        console.log(chalk_1.default.cyan(`Tests generados: ${testSuite.tests.length}`));
        for (const [type, count] of Object.entries(byType)) {
            console.log(chalk_1.default.gray(`  ${type}: ${count}`));
        }
    }
    console.log(chalk_1.default.cyan(`Directorio reportes: ${config.report.reportDir}`));
    if (options.browserstack) {
        console.log(chalk_1.default.cyan(`\n🔗 Ver resultados en: https://automate.browserstack.com/dashboard`));
        console.log(chalk_1.default.gray(`   Proyecto: ${config.browserstack.projectName}`));
        console.log(chalk_1.default.gray(`   Build: ${config.browserstack.buildName}`));
    }
    else {
        const htmlPath = context.reportFolder
            ? path.join(context.reportFolder, 'index.html')
            : path.join(config.report.reportDir, 'playwright-report', 'index.html');
        console.log(chalk_1.default.cyan(`\n📄 Reporte HTML: ${htmlPath}`));
    }
    console.log(chalk_1.default.bold('='.repeat(60)) + '\n');
}
main();
//# sourceMappingURL=index.js.map