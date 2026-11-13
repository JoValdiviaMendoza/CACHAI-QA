#!/usr/bin/env node
"use strict";
/**
 * CACHAI-QA - Pruebas en lenguaje natural a partir de un escaneo
 *
 * Lee un JSON generado por las opciones de escaneo (scan-report/*.json),
 * reconstruye las paginas y sus elementos, y genera:
 *   - reports/generated-tests/cachai-tests.spec.ts   (Playwright + BDD)
 *   - reports/generated-tests/cachai-tests.feature   (Gherkin en espanol)
 *   - reports/generated-tests/playwright.config.ts
 *   - reports/<host>-<fecha>.json                    (resumen para el panel web)
 *
 * Uso: ts-node cli/from-scan.ts [--scan=archivo.json] [--run] [--verbose]
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
const dotenv = __importStar(require("dotenv"));
const child_process_1 = require("child_process");
const cucumber_steps_template_1 = require("./cucumber-steps-template");
const browserstack_1 = require("../core/browserstack");
// Cargar .env para que BrowserStack funcione también desde el .bat y el panel.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
// ============================================
// Constantes
// ============================================
const SCAN_DIR = 'scan-report';
const REPORT_ROOT = 'reports';
const DEFAULT_OUT_DIR = path.join(REPORT_ROOT, 'generated-tests');
const SPEC_NAME = 'cachai-tests.spec.ts';
const FEATURE_NAME = 'cachai-tests.feature';
const CONFIG_NAME = 'playwright.config.ts';
const STEPS_NAME = 'cachai-steps.ts';
const BROWSERSTACK_FIXTURE_NAME = 'cachai-browserstack.ts';
const BROWSERSTACK_META_NAME = 'browserstack.json';
const DEFAULT_MAX_LINKS_PER_PAGE = 40;
const MAX_IMAGES_PER_PAGE = 80;
const MAX_BUTTONS_PER_PAGE = 10;
/** Peticiones de enlaces simultáneas dentro de un escenario. */
const LINKS_CONCURRENCY = 4;
// ============================================
// Utilidades de sistema
// ============================================
function findRoot() {
    const candidates = [
        process.cwd(),
        path.resolve(__dirname, '..'),
        path.resolve(__dirname, '..', '..')
    ];
    for (const dir of candidates) {
        if (fs.existsSync(path.join(dir, 'package.json')))
            return dir;
    }
    return process.cwd();
}
function statMtime(file) {
    try {
        return fs.statSync(file).mtimeMs;
    }
    catch {
        return 0;
    }
}
function formatDate(ms) {
    if (!ms)
        return 'sin fecha';
    try {
        return new Date(ms).toLocaleString('es-CL');
    }
    catch {
        return 'sin fecha';
    }
}
function slugDate(date = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}
function toPosix(value) {
    return value.split(path.sep).join('/');
}
/** Escapa un texto para incrustarlo como string literal en el spec generado. */
function esc(value) {
    return "'" + String(value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r?\n/g, ' ')
        .replace(/\u2028|\u2029/g, ' ') + "'";
}
function ask(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(query, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}
// ============================================
// Lectura y seleccion de escaneos
// ============================================
function readScanFile(file) {
    let text = fs.readFileSync(file, 'utf8');
    if (text.charCodeAt(0) === 0xfeff)
        text = text.slice(1);
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || !data.baseUrl || !Array.isArray(data.links)) {
        throw new Error(`El archivo no tiene el formato de un escaneo de CACHAI-QA: ${file}`);
    }
    return data;
}
function listScans(root) {
    const dir = path.join(root, SCAN_DIR);
    if (!fs.existsSync(dir))
        return [];
    return fs.readdirSync(dir)
        .filter((name) => name.toLowerCase().endsWith('.json'))
        .map((name) => path.join(dir, name))
        .sort((a, b) => statMtime(b) - statMtime(a));
}
function describeScan(file) {
    try {
        const scan = readScanFile(file);
        const parts = [scan.baseUrl];
        if (typeof scan.totalPages === 'number')
            parts.push(`${scan.totalPages} pág.`);
        if (Array.isArray(scan.links))
            parts.push(`${scan.links.length} elem.`);
        return parts.join(' · ');
    }
    catch {
        return '(JSON ilegible)';
    }
}
function resolveScanPath(root, input) {
    const candidates = [
        path.resolve(root, input),
        path.resolve(root, SCAN_DIR, input)
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate))
            return candidate;
    }
    throw new Error(`No se encontró el escaneo indicado: ${input}`);
}
async function pickScan(root) {
    const files = listScans(root);
    if (files.length === 0) {
        throw new Error(`No hay escaneos en ${SCAN_DIR}/. Ejecuta primero una opción de escaneo ([1], [2] o [3]).`);
    }
    if (!process.stdin.isTTY)
        return files[0];
    const shown = files.slice(0, 15);
    console.log('Escaneos disponibles:\n');
    shown.forEach((file, index) => {
        console.log(`  [${index + 1}] ${toPosix(path.relative(root, file))}`);
        console.log(`      ${describeScan(file)} · ${formatDate(statMtime(file))}`);
    });
    console.log('');
    const answer = await ask('Elige un escaneo [Enter = el más reciente]: ');
    if (!answer)
        return shown[0];
    const index = Number(answer);
    if (Number.isInteger(index) && index >= 1 && index <= shown.length) {
        return shown[index - 1];
    }
    console.log(`Opción inválida; se usará el escaneo más reciente.`);
    return shown[0];
}
// ============================================
// Reconstruccion de paginas
// ============================================
function normalizeUrl(raw, base) {
    try {
        const parsed = new URL(raw, base);
        parsed.hash = '';
        return parsed.toString();
    }
    catch {
        return raw;
    }
}
function isHttpUrl(value) {
    return /^https?:\/\//i.test(value);
}
function pageLabelOf(url) {
    try {
        const parsed = new URL(url);
        const label = `${parsed.pathname}${parsed.search}`;
        return label === '' ? '/' : label;
    }
    catch {
        return url;
    }
}
function kindOf(element) {
    const tag = String(element.tagName || '').toLowerCase();
    if (tag === 'a')
        return 'link';
    if (tag === 'img')
        return 'image';
    if (tag === 'form')
        return 'form';
    if (tag === 'input' || tag === 'button')
        return 'button';
    return 'other';
}
function pushUnique(target, row) {
    if (target.some((item) => item.url === row.url && item.text === row.text))
        return;
    target.push(row);
}
function buildPages(scan) {
    const pages = new Map();
    const getPage = (url) => {
        let page = pages.get(url);
        if (!page) {
            page = { url, links: [], images: [], forms: [], buttons: [], custom: [] };
            pages.set(url, page);
        }
        return page;
    };
    for (const element of scan.links || []) {
        if (!element || typeof element !== 'object')
            continue;
        // Los escaneos nuevos traen `sourceUrl` (pagina donde se encontro el elemento).
        // Los antiguos solo tienen `parentUrl`, por lo que se usa como aproximacion.
        const pageUrl = normalizeUrl(element.sourceUrl || element.parentUrl || scan.baseUrl, scan.baseUrl);
        if (!isHttpUrl(pageUrl))
            continue;
        const target = normalizeUrl(String(element.url || ''), pageUrl);
        const page = getPage(pageUrl);
        const text = String(element.text || '').replace(/\s+/g, ' ').trim().slice(0, 90);
        const kind = kindOf(element);
        if (kind === 'link') {
            if (!isHttpUrl(target))
                continue;
            if (element.isInternal === false)
                continue; // Solo enlaces internos
            pushUnique(page.links, { url: target, text: text || target });
        }
        else if (kind === 'image') {
            if (!isHttpUrl(target))
                continue;
            pushUnique(page.images, { url: target, text });
        }
        else if (kind === 'form') {
            pushUnique(page.forms, { url: pageUrl, text: text || 'formulario' });
        }
        else if (kind === 'button') {
            pushUnique(page.buttons, { url: target, text: text || 'botón' });
        }
        else if (target && isHttpUrl(target)) {
            pushUnique(page.custom, { url: target, text });
        }
    }
    return Array.from(pages.values());
}
// ============================================
// Generacion de escenarios (lenguaje natural)
// ============================================
function loadScenario(page) {
    const label = pageLabelOf(page.url);
    return {
        type: 'navigation',
        priority: 'high',
        title: `La página «${label}» carga sin errores`,
        scenario: `Carga de la página «${label}»`,
        gherkin: [
            `Dado que un usuario abre "${page.url}"`,
            'Cuando la página termina de cargar',
            'Entonces debe responder con un código menor a 400',
            'Y no debe lanzar errores de JavaScript'
        ],
        fixtures: 'page',
        body: [
            '    const erroresJS: string[] = [];',
            "    page.on('pageerror', (error) => erroresJS.push(error.message));",
            '',
            `    const respuesta = await page.goto(${esc(page.url)}, { waitUntil: 'domcontentloaded' });`,
            "    expect(respuesta, 'La página debe responder').not.toBeNull();",
            "    expect(respuesta?.status() ?? 0, 'La página debe responder 2xx/3xx').toBeLessThan(400);",
            '',
            "    await page.waitForLoadState('load');",
            "    expect(erroresJS, 'La página no debe lanzar errores de JavaScript').toEqual([]);"
        ]
    };
}
function linksScenario(page, seenLinks, maxLinks, linkBrowser) {
    const uniqueLinks = page.links.filter((link) => !seenLinks.has(link.url));
    const links = uniqueLinks.slice(0, maxLinks);
    if (links.length === 0)
        return null;
    for (const link of links)
        seenLinks.add(link.url);
    const label = pageLabelOf(page.url);
    const truncated = uniqueLinks.length > links.length
        ? ` (se verifican ${links.length} de ${uniqueLinks.length} enlaces nuevos)`
        : '';
    const body = ['    const enlaces = ['];
    for (const link of links) {
        body.push(`      { texto: ${esc(link.text)}, url: ${esc(link.url)} },`);
    }
    body.push('    ];');
    body.push('');
    body.push('    // Los enlaces se comprueban con peticiones HTTP: no dependen del navegador,');
    body.push('    // así que se ejecutan una sola vez en lugar de repetirse en cada proyecto.');
    body.push(`    test.skip(test.info().project.name !== ${esc(linkBrowser)}, 'La comprobación de enlaces no depende del navegador');`);
    body.push('');
    body.push(`    test.setTimeout(Math.max(60000, Math.ceil(enlaces.length / ${LINKS_CONCURRENCY}) * 18000 + 15000));`);
    body.push('');
    body.push('    const resultados = await comprobarEnlaces(request, enlaces);');
    body.push("    const rotos = resultados.filter((resultado) => resultado.estado === 'roto');");
    body.push("    const sinVerificar = resultados.filter((resultado) => resultado.estado === 'sin-verificar');");
    body.push('');
    body.push('    if (sinVerificar.length > 0) {');
    body.push('      test.info().annotations.push({');
    body.push("        type: 'enlaces-sin-verificar',");
    body.push('        description: `${sinVerificar.length} de ${enlaces.length} enlaces no respondieron a tiempo y no se cuentan como fallo: ` + sinVerificar.map((resultado) => resultado.url).join(", ")');
    body.push('      });');
    body.push('    }');
    body.push('');
    body.push('    expect(');
    body.push('      rotos.map((resultado) => resultado.status');
    body.push('        ? `${resultado.texto} (${resultado.url}) respondió HTTP ${resultado.status}`');
    body.push("        : `${resultado.texto} (${resultado.url}) no se pudo conectar: ${resultado.error || 'error de red'}`),");
    body.push("      'Los enlaces internos deben responder con un código menor a 400'");
    body.push('    ).toEqual([]);');
    return {
        type: 'broken-link',
        priority: 'high',
        title: links.length === 1
            ? `El enlace interno de «${label}» responde sin errores`
            : `Los ${links.length} enlaces internos de «${label}» responden sin errores`,
        scenario: `Enlaces internos de «${label}»${truncated}`,
        gherkin: [
            `Dado que un usuario visita "${page.url}"`,
            links.length === 1
                ? 'Cuando revisa su enlace interno'
                : `Cuando revisa sus ${links.length} enlaces internos${truncated}`,
            'Entonces todos deben responder con un código menor a 400'
        ],
        fixtures: 'request',
        body
    };
}
function imagesScenario(page) {
    const images = page.images.slice(0, MAX_IMAGES_PER_PAGE);
    if (images.length === 0)
        return null;
    const label = pageLabelOf(page.url);
    const body = [
        `    await page.goto(${esc(page.url)}, { waitUntil: 'domcontentloaded' });`,
        "    await page.waitForLoadState('load');",
        '',
        "    const imagenes = page.locator('img[src]');",
        `    expect(await imagenes.count(), 'La página debe contener las imágenes escaneadas').toBeGreaterThanOrEqual(${images.length});`,
        '',
        '    const rotas = await imagenes.evaluateAll((elementos) =>',
        '      elementos',
        '        .filter((elemento) => {',
        '          const img = elemento as HTMLImageElement;',
        '          return !img.complete || img.naturalWidth === 0;',
        '        })',
        '        .map((elemento) => {',
        '          const img = elemento as HTMLImageElement;',
        "          return img.getAttribute('src') || '(sin src)';",
        '        })',
        '    );',
        "    expect(rotas, 'Ninguna imagen debe estar rota').toEqual([]);"
    ];
    return {
        type: 'image-load',
        priority: 'medium',
        title: images.length === 1
            ? `La imagen de «${label}» carga correctamente`
            : `Las ${images.length} imágenes de «${label}» cargan correctamente`,
        scenario: `Carga de imágenes de «${label}»`,
        gherkin: [
            `Dado que un usuario visita "${page.url}"`,
            images.length === 1
                ? 'Cuando se carga la imagen de la página'
                : `Cuando se cargan las ${images.length} imágenes de la página`,
            'Entonces ninguna debe estar rota (todas tienen ancho natural mayor a 0)'
        ],
        fixtures: 'page',
        body
    };
}
function formsScenario(page) {
    const forms = page.forms;
    if (forms.length === 0)
        return null;
    const label = pageLabelOf(page.url);
    const body = [
        `    await page.goto(${esc(page.url)}, { waitUntil: 'domcontentloaded' });`,
        '',
        "    const formularios = page.locator('form');",
        `    expect(await formularios.count(), 'La página debe contener los formularios escaneados').toBeGreaterThanOrEqual(${forms.length});`,
        '',
        "    const visibles = page.locator('form:visible');",
        '    const totalVisibles = await visibles.count();',
        '',
        '    for (let indice = 0; indice < totalVisibles; indice++) {',
        "      const controles = visibles.nth(indice).locator('input, select, textarea, button');",
        '      expect(await controles.count(), `El formulario visible #${indice + 1} debe tener controles`).toBeGreaterThan(0);',
        '    }'
    ];
    return {
        type: 'form-validation',
        priority: 'high',
        title: forms.length === 1
            ? `El formulario de «${label}» está presente y los visibles tienen controles`
            : `Los formularios de «${label}» están presentes y los visibles tienen controles`,
        scenario: `Formularios de «${label}»`,
        gherkin: [
            `Dado que un usuario visita "${page.url}"`,
            forms.length === 1
                ? 'Cuando busca el formulario de la página'
                : `Cuando busca los ${forms.length} formularios de la página`,
            'Entonces deben estar presentes en el DOM y los visibles deben tener controles'
        ],
        fixtures: 'page',
        body
    };
}
function buttonsScenario(page) {
    const buttons = page.buttons.slice(0, MAX_BUTTONS_PER_PAGE);
    if (buttons.length === 0)
        return null;
    const label = pageLabelOf(page.url);
    const body = [
        `    await page.goto(${esc(page.url)}, { waitUntil: 'domcontentloaded' });`,
        '',
        "    const botones = page.locator('button, input[type=\"button\"], input[type=\"submit\"], input[type=\"reset\"], a[role=\"button\"]');",
        `    expect(await botones.count(), 'La página debe contener los botones escaneados').toBeGreaterThanOrEqual(${buttons.length});`,
        '',
        "    const visibles = page.locator('button:visible, input[type=\"button\"]:visible, input[type=\"submit\"]:visible, input[type=\"reset\"]:visible, a[role=\"button\"]:visible');",
        '    const totalVisibles = await visibles.count();',
        '',
        '    if (totalVisibles > 0) {',
        '      let habilitados = 0;',
        '      for (let indice = 0; indice < totalVisibles; indice++) {',
        '        if (await visibles.nth(indice).isEnabled()) habilitados++;',
        '      }',
        "      expect(habilitados, 'Debe haber al menos un botón visible y habilitado').toBeGreaterThan(0);",
        '    }'
    ];
    return {
        type: 'button-click',
        priority: 'medium',
        title: buttons.length === 1
            ? `El botón de «${label}» está presente y los visibles están habilitados`
            : `Los botones de «${label}» están presentes y los visibles están habilitados`,
        scenario: `Botones principales de «${label}»`,
        gherkin: [
            `Dado que un usuario visita "${page.url}"`,
            buttons.length === 1
                ? 'Cuando revisa el botón de la página'
                : `Cuando revisa los ${buttons.length} botones de la página`,
            'Entonces deben estar presentes y, si son visibles, al menos uno debe estar habilitado'
        ],
        fixtures: 'page',
        body
    };
}
function customScenario(page, selector) {
    const elements = page.custom;
    if (elements.length === 0)
        return null;
    const label = pageLabelOf(page.url);
    const mensajeSelector = esc(`El selector «${selector}» debe encontrar elementos`);
    const body = [
        `    await page.goto(${esc(page.url)}, { waitUntil: 'domcontentloaded' });`,
        '',
        `    const elementos = page.locator(${esc(selector)});`,
        `    expect(await elementos.count(), ${mensajeSelector}).toBeGreaterThan(0);`
    ];
    return {
        type: 'custom',
        priority: 'medium',
        title: `El selector «${selector}» encuentra elementos en «${label}»`,
        scenario: `Selector personalizado «${selector}» en «${label}»`,
        gherkin: [
            `Dado que un usuario visita "${page.url}"`,
            `Cuando busca los elementos con el selector "${selector}"`,
            `Entonces debe encontrar al menos ${elements.length} elemento(s)`
        ],
        fixtures: 'page',
        body
    };
}
function buildPageScenarios(page, customSelector, seenLinks, options) {
    const scenarios = [loadScenario(page)];
    const links = linksScenario(page, seenLinks, options.maxLinks, options.linkBrowser);
    if (links)
        scenarios.push(links);
    const images = imagesScenario(page);
    if (images)
        scenarios.push(images);
    const forms = formsScenario(page);
    if (forms)
        scenarios.push(forms);
    const buttons = buttonsScenario(page);
    if (buttons)
        scenarios.push(buttons);
    if (customSelector) {
        const custom = customScenario(page, customSelector);
        if (custom)
            scenarios.push(custom);
    }
    return { url: page.url, label: pageLabelOf(page.url), scenarios };
}
// ============================================
// Render de archivos
// ============================================
function buildSpecFile(pageSpecs, meta) {
    const lines = [];
    lines.push('// Auto-generado por CACHAI-QA — no editar a mano.');
    lines.push(`// Escaneo: ${meta.scanPath}`);
    lines.push(`// Generado: ${meta.generatedAt}`);
    lines.push(`// Páginas: ${pageSpecs.length} · Escenarios: ${meta.totalTests}`);
    lines.push(`// Ejecución: ${meta.browserstack ? 'BrowserStack' : 'local'}`);
    lines.push('');
    if (meta.browserstack) {
        lines.push("import { test, expect } from './cachai-browserstack';");
        lines.push("import type { APIRequestContext } from '@playwright/test';");
    }
    else {
        lines.push("import { test, expect, type APIRequestContext } from '@playwright/test';");
    }
    lines.push('');
    lines.push('// --- Comprobación de enlaces (compartida por los escenarios generados) ---');
    lines.push('');
    lines.push('const REINTENTOS_ENLACE = 2;');
    lines.push('const TIMEOUT_ENLACE_MS = 8000;');
    lines.push(`const CONCURRENCIA_ENLACES = ${LINKS_CONCURRENCY};`);
    lines.push('const ERROR_RED_RE = /ECONNREFUSED|ENOTFOUND|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_SSL|ERR_CERT|ERR_TOO_MANY_REDIRECTS|ERR_UNSAFE_REDIRECT|ERR_INVALID_URL|Protocol .* not supported|ERR_ABORTED/i;');
    lines.push('');
    lines.push('interface EnlaceEscaneado { texto: string; url: string; }');
    lines.push('interface ResultadoEnlace {');
    lines.push('  texto: string;');
    lines.push('  url: string;');
    lines.push("  estado: 'ok' | 'roto' | 'sin-verificar';");
    lines.push('  status?: number;');
    lines.push('  error?: string;');
    lines.push('}');
    lines.push('');
    lines.push('/**');
    lines.push(' * Comprueba un enlace y distingue dos situaciones muy distintas:');
    lines.push(' *  - roto: el servidor respondió 4xx/5xx o hubo un error de red/infraestructura');
    lines.push(' *    (DNS, conexión rechazada, SSL, URL inválida). Es un defecto real.');
    lines.push(' *  - sin-verificar: la petición no terminó a tiempo tras varios intentos');
    lines.push(' *    (lentitud o rate limiting; no se cuenta como enlace roto).');
    lines.push(' */');
    lines.push('async function comprobarEnlace(request: APIRequestContext, enlace: EnlaceEscaneado): Promise<ResultadoEnlace> {');
    lines.push("  let ultimoError = '';");
    lines.push('  for (let intento = 1; intento <= REINTENTOS_ENLACE; intento++) {');
    lines.push('    try {');
    lines.push('      const respuesta = await request.get(enlace.url, {');
    lines.push('        timeout: TIMEOUT_ENLACE_MS,');
    lines.push('        maxRedirects: 10,');
    lines.push('        failOnStatusCode: false');
    lines.push('      });');
    lines.push('      const status = respuesta.status();');
    lines.push('      return {');
    lines.push('        texto: enlace.texto,');
    lines.push('        url: enlace.url,');
    lines.push("        estado: status >= 400 ? 'roto' : 'ok',");
    lines.push('        status');
    lines.push('      };');
    lines.push('    } catch (error) {');
    lines.push('      ultimoError = error instanceof Error ? error.message : String(error);');
    lines.push('      if (intento < REINTENTOS_ENLACE) {');
    lines.push('        await new Promise((resolve) => setTimeout(resolve, 400 * intento));');
    lines.push('      }');
    lines.push('    }');
    lines.push('  }');
    lines.push("  const estado = ERROR_RED_RE.test(ultimoError) ? 'roto' : 'sin-verificar';");
    lines.push("  return { texto: enlace.texto, url: enlace.url, estado, error: ultimoError };");
    lines.push('}');
    lines.push('');
    lines.push('/** Ejecuta las comprobaciones con un pool pequeño para no saturar el sitio. */');
    lines.push('async function comprobarEnlaces(request: APIRequestContext, enlaces: EnlaceEscaneado[]): Promise<ResultadoEnlace[]> {');
    lines.push('  const resultados: ResultadoEnlace[] = new Array(enlaces.length);');
    lines.push('  let siguiente = 0;');
    lines.push('  const trabajadores = Array.from({ length: Math.min(CONCURRENCIA_ENLACES, enlaces.length) }, async () => {');
    lines.push('    while (true) {');
    lines.push('      const indice = siguiente++;');
    lines.push('      if (indice >= enlaces.length) return;');
    lines.push('      resultados[indice] = await comprobarEnlace(request, enlaces[indice]);');
    lines.push('    }');
    lines.push('  });');
    lines.push('  await Promise.all(trabajadores);');
    lines.push('  return resultados;');
    lines.push('}');
    lines.push('');
    const usedTitles = new Set();
    for (const page of pageSpecs) {
        lines.push(`test.describe(${esc('Página ' + page.label)}, () => {`);
        for (const scenario of page.scenarios) {
            let title = scenario.title;
            let suffix = 1;
            while (usedTitles.has(title)) {
                suffix++;
                title = `${scenario.title} (${suffix})`;
            }
            usedTitles.add(title);
            lines.push('  /**');
            lines.push(`   * Escenario: ${scenario.scenario}`);
            for (const step of scenario.gherkin)
                lines.push(`   *   ${step}`);
            lines.push('   */');
            lines.push(`  test(${esc(title)}, async ({ ${scenario.fixtures} }) => {`);
            for (const bodyLine of scenario.body)
                lines.push(bodyLine);
            lines.push('  });');
            lines.push('');
        }
        lines.push('});');
        lines.push('');
    }
    return lines.join('\n');
}
function buildFeatureFile(scan, pageSpecs) {
    const lines = [];
    let host = scan.baseUrl;
    try {
        host = new URL(scan.baseUrl).host;
    }
    catch {
        // Mantener baseUrl como referencia
    }
    lines.push('# language: es');
    lines.push(`Característica: Calidad del sitio ${host}`);
    lines.push(`  Escaneo realizado sobre "${scan.baseUrl}"${scan.timestamp ? ` el ${scan.timestamp}` : ''}.`);
    lines.push('');
    for (const page of pageSpecs) {
        for (const scenario of page.scenarios) {
            lines.push(`  Escenario: ${scenario.scenario}`);
            for (const step of scenario.gherkin)
                lines.push(`    ${step}`);
            lines.push('');
        }
    }
    return lines.join('\n');
}
/** Normaliza los navegadores pedidos y genera proyectos válidos de Playwright. */
function parseBrowsers(value, browserstack = false) {
    const localAliases = {
        chromium: { name: 'chromium', use: "{ browserName: 'chromium' }" },
        chrome: { name: 'chrome', use: "{ browserName: 'chromium', channel: 'chrome' }" },
        'google-chrome': { name: 'chrome', use: "{ browserName: 'chromium', channel: 'chrome' }" },
        firefox: { name: 'firefox', use: "{ browserName: 'firefox' }" },
        webkit: { name: 'webkit', use: "{ browserName: 'webkit' }" },
        safari: { name: 'webkit', use: "{ browserName: 'webkit' }" },
        edge: { name: 'edge', use: "{ browserName: 'chromium', channel: 'msedge' }" },
        msedge: { name: 'edge', use: "{ browserName: 'chromium', channel: 'msedge' }" }
    };
    const result = [];
    const seen = new Set();
    for (const raw of String(value || '').split(',')) {
        const key = raw.trim().toLowerCase();
        if (!key)
            continue;
        if (browserstack) {
            const target = (0, browserstack_1.resolveBrowserStackTarget)(key);
            if (seen.has(target.id))
                continue;
            seen.add(target.id);
            const version = target.browser_version ? esc(target.browser_version) : 'undefined';
            result.push({
                name: target.id,
                use: `{ browserName: 'chromium', connectOptions: { wsEndpoint: ` +
                    `browserStackEndpoint(${esc(target.browser)}, ${esc(target.os)}, ${esc(target.os_version)}, ${version}, ${esc(target.label)}) } }`
            });
            continue;
        }
        const browser = localAliases[key];
        if (!browser || seen.has(browser.name))
            continue;
        seen.add(browser.name);
        result.push(browser);
    }
    if (result.length > 0)
        return result;
    if (browserstack) {
        const target = (0, browserstack_1.resolveBrowserStackTarget)('chromium');
        const version = target.browser_version ? esc(target.browser_version) : 'undefined';
        return [{
                name: target.id,
                use: `{ browserName: 'chromium', connectOptions: { wsEndpoint: ` +
                    `browserStackEndpoint(${esc(target.browser)}, ${esc(target.os)}, ${esc(target.os_version)}, ${version}, ${esc(target.label)}) } }`
            }];
    }
    return [localAliases.chromium];
}
function buildConfigFile(reportFolder, resultsFile, timeout, browsers, workers, browserstack = false, buildName = '') {
    const projects = browsers
        .map((browser) => `{ name: ${esc(browser.name)}, use: ${browser.use} }`)
        .join(', ');
    const safeWorkers = browserstack
        ? 1
        : Math.max(1, Math.min(32, Math.floor(Number(workers) || 1)));
    const safeTimeout = browserstack ? Math.max(180000, Number(timeout) || 0) : timeout;
    const lines = [
        "import { defineConfig } from '@playwright/test';",
        '',
        '// BrowserStack: las credenciales se leen del entorno; no se escriben aquí.',
        'const BROWSERSTACK_LOCAL = process.env.CACHAI_BROWSERSTACK_LOCAL === "1";',
        `const BROWSERSTACK_BUILD = process.env.CACHAI_BROWSERSTACK_BUILD || ${esc(buildName || 'CACHAI-QA')};`,
        'function browserStackEndpoint(browser: string, os: string, osVersion: string, browserVersion: string | undefined, label: string): string {',
        '  const username = process.env.BROWSERSTACK_USERNAME;',
        '  const accessKey = process.env.BROWSERSTACK_ACCESS_KEY;',
        '  if (!username || !accessKey) {',
        '    throw new Error("BrowserStack requiere BROWSERSTACK_USERNAME y BROWSERSTACK_ACCESS_KEY en src/.env.");',
        '  }',
        '  const caps: Record<string, string | boolean> = {',
        '    browser,',
        '    os,',
        '    os_version: osVersion,',
        '    "browserstack.username": username,',
        '    "browserstack.accessKey": accessKey,',
        '    project: "CACHAI-QA",',
        '    build: BROWSERSTACK_BUILD,',
        `    name: "CACHAI-QA · " + label,`,
        '    "browserstack.debug": true,',
        '    "browserstack.console": "errors",',
        '    "browserstack.networkLogs": true,',
        '    "browserstack.video": true,',
        '    "browserstack.playwrightVersion": "1.latest",',
        '    "client.playwrightVersion": "1.latest",',
        '    "browserstack.local": BROWSERSTACK_LOCAL ? "true" : "false"',
        '  };',
        '  if (browserVersion) caps.browser_version = browserVersion;',
        '  if (BROWSERSTACK_LOCAL) {',
        '    caps["browserstack.localIdentifier"] = process.env.CACHAI_BROWSERSTACK_LOCAL_IDENTIFIER || "cachai-qa";',
        '  }',
        '  return `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(caps))}`;',
        '}',
        '',
        'export default defineConfig({',
        "  testDir: '.',",
        `  testMatch: ${esc(SPEC_NAME)},`,
        `  timeout: ${safeTimeout},`,
        '  retries: 0,',
        `  fullyParallel: ${browserstack ? 'false' : 'true'},`,
        `  workers: ${safeWorkers},`,
        '  use: {',
        ...(browserstack
            ? [
                '    viewport: { width: 1366, height: 768 },',
                '    navigationTimeout: 45000,',
                '    screenshot: \'only-on-failure\''
            ]
            : [
                '    headless: true,',
                '    viewport: { width: 1366, height: 768 },',
                '    navigationTimeout: 45000,',
                "    trace: 'on-first-retry',",
                "    screenshot: 'only-on-failure',",
                "    video: 'retain-on-failure'"
            ]),
        '  },',
        `  projects: [${projects}],`,
        `  reporter: [['html', { outputFolder: ${esc(reportFolder)}, open: 'never' }], ['json', { outputFile: ${esc(resultsFile)} }]]`,
        '});',
        ''
    ];
    return lines.join('\n');
}
/** Escribe los metadatos que usa el dashboard para la pestaña BrowserStack. */
function writeBrowserStackMetadata(reportFolder, meta) {
    const payload = JSON.stringify({
        provider: 'browserstack',
        project: 'CACHAI-QA',
        build: meta.buildName,
        dashboardUrl: (0, browserstack_1.browserStackDashboardUrl)(meta.buildName),
        targetUrl: meta.targetUrl,
        local: meta.local,
        browsers: meta.browsers,
        createdAt: meta.generatedAt
    }, null, 2);
    fs.mkdirSync(reportFolder, { recursive: true });
    fs.writeFileSync(path.join(reportFolder, BROWSERSTACK_META_NAME), payload, 'utf8');
    // Copia fuera de la carpeta del reporte: el reporter HTML puede limpiarla
    // al ejecutar Playwright manualmente.
    const slug = path.basename(reportFolder).replace(/^playwright-report-/, '');
    fs.writeFileSync(path.join(path.dirname(reportFolder), `browserstack-${slug}.json`), payload, 'utf8');
}
/**
 * Fixture mínimo para marcar el estado real de cada sesión en BrowserStack.
 * Solo se genera cuando se ejecuta en la nube; el flujo local no lo usa.
 */
function buildBrowserStackFixture() {
    return [
        '// Auto-generado por CACHAI-QA para BrowserStack.',
        "import { test as base, expect } from '@playwright/test';",
        '',
        'export const test = base.extend({',
        '  page: async ({ page }, use, testInfo) => {',
        '    try {',
        '      await use(page);',
        '    } finally {',
        "      if (testInfo.status !== 'skipped') {",
        "        const status = testInfo.status === 'passed' ? 'passed' : 'failed';",
        "        const errorMessage = testInfo.error && testInfo.error.message ? String(testInfo.error.message) : testInfo.status;",
        '        const payload = JSON.stringify({',
        "          action: 'setSessionStatus',",
        "          arguments: { status, reason: errorMessage.slice(0, 500) }",
        '        });',
        '        try {',
        '          await page.evaluate((_payload: unknown) => {}, `browserstack_executor: ${payload}`);',
        '        } catch {',
        '          // La página pudo cerrarse por un fallo; la sesión ya quedó registrada.',
        '        }',
        '      }',
        '    }',
        '  }',
        '});',
        '',
        'export { expect };',
        ''
    ].join('\n');
}
function buildSummary(scan, scanPath, pages, pageSpecs, options) {
    const tests = pageSpecs.flatMap((page) => page.scenarios.map((scenario, index) => ({
        id: `${scenario.type}-${String(index + 1).padStart(3, '0')}`,
        name: scenario.title,
        type: scenario.type,
        priority: scenario.priority,
        page: page.url
    })));
    const counter = (value, fallback) => typeof value === 'number' ? value : fallback;
    return {
        metadata: {
            timestamp: new Date().toISOString(),
            targetUrl: scan.baseUrl,
            mode: 'local',
            pagesScanned: pages.length,
            testsGenerated: tests.length,
            scanSource: toPosix(path.relative(options.root, scanPath)),
            scanTimestamp: scan.timestamp || null,
            scanErrors: scan.errors?.length || 0,
            skippedDownloads: scan.downloads?.length || 0,
            invalidLinks: scan.invalidLinks?.length || 0,
            config: {
                elementType: scan.scanMeta?.elementType || 'links',
                depth: counter(scan.scanMeta?.depth, 0),
                maxPages: counter(scan.scanMeta?.maxPages, pages.length),
                browsers: options.browsers,
                workers: options.workers,
                maxLinks: options.maxLinks
            }
        },
        pages: pages.map((page) => ({
            url: page.url,
            title: pageLabelOf(page.url),
            linksCount: page.links.length,
            imagesCount: page.images.length,
            formsCount: page.forms.length,
            buttonsCount: page.buttons.length,
            customCount: page.custom.length
        })),
        testSuite: {
            name: `CACHAI-QA Suite - ${new URL(scan.baseUrl).hostname}`,
            tests
        }
    };
}
// ============================================
// Ejecucion de Playwright
// ============================================
function runPlaywright(outDir, options = {}) {
    console.log('');
    console.log(options.browserstack
        ? 'Ejecutando las pruebas en BrowserStack...'
        : 'Ejecutando las pruebas con Playwright...');
    console.log('');
    const env = {
        ...process.env,
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
        ...(options.browserstack
            ? {
                CACHAI_BROWSERSTACK: '1',
                CACHAI_BROWSERSTACK_BUILD: options.buildName || (0, browserstack_1.browserStackBuildName)(),
                CACHAI_BROWSERSTACK_LOCAL: options.local ? '1' : '0',
                ...(options.localIdentifier
                    ? { CACHAI_BROWSERSTACK_LOCAL_IDENTIFIER: options.localIdentifier }
                    : {})
            }
            : {})
    };
    const result = (0, child_process_1.spawnSync)('npx', ['playwright', 'test', '--config', CONFIG_NAME], {
        cwd: outDir,
        shell: true,
        stdio: 'inherit',
        env
    });
    if (result.error) {
        console.error(`No se pudo iniciar Playwright: ${result.error.message}`);
        return 1;
    }
    return typeof result.status === 'number' ? result.status : 1;
}
/**
 * Abre el panel web en una ventana aparte para no bloquear la consola actual.
 * El panel sirve los escaneos, las pruebas y los reportes generados.
 */
function openDashboard(root, port = 4321) {
    console.log(`Abriendo el panel web en http://localhost:${port} (o el siguiente puerto libre)...`);
    if (process.platform === 'win32') {
        // `start` abre una consola propia para poder cerrar el panel sin matar esta sesión.
        (0, child_process_1.exec)('start "CACHAI-QA - Panel Web" cmd /k node dashboard\\server.js', { cwd: root }, () => {
            // El panel queda corriendo en su propia ventana.
        });
        return;
    }
    (0, child_process_1.spawn)('node', ['dashboard/server.js'], {
        cwd: root,
        detached: true,
        stdio: 'ignore'
    }).unref();
}
// ============================================
// Main
// ============================================
async function main() {
    const yargsModule = await Promise.resolve().then(() => __importStar(require('yargs')));
    const { hideBin } = await Promise.resolve().then(() => __importStar(require('yargs/helpers')));
    const yargsFn = yargsModule.default || yargsModule;
    const argv = await yargsFn(hideBin(process.argv))
        .option('scan', { alias: 's', type: 'string', describe: 'Archivo JSON de escaneo (por defecto: el más reciente)' })
        .option('run', { alias: 'r', type: 'boolean', default: false, describe: 'Ejecutar las pruebas después de generarlas' })
        .option('output', { alias: 'o', type: 'string', describe: 'Carpeta de salida de las pruebas' })
        .option('browserstack', { alias: 'bs', type: 'boolean', default: false, describe: 'Ejecutar Playwright en BrowserStack (solo requiere credenciales en .env)' })
        .option('browsers', { type: 'string', describe: 'Navegadores separados por coma. Local: chromium,firefox,chrome. BrowserStack: chromium,firefox,webkit' })
        .option('timeout', { type: 'number', default: 60000, describe: 'Timeout por prueba (ms)' })
        .option('workers', { type: 'number', default: 5, describe: 'Cantidad de pruebas Playwright en paralelo' })
        .option('max-links', { type: 'number', default: DEFAULT_MAX_LINKS_PER_PAGE, describe: 'Máximo de enlaces nuevos a comprobar por página' })
        .option('prompt', { type: 'boolean', default: true, describe: 'Permitir preguntas interactivas (usa --no-prompt para desactivarlas)' })
        .option('open', { type: 'boolean', default: true, describe: 'Ofrecer abrir el panel web al final (usa --no-open para omitirlo)' })
        .help()
        .alias('help', 'h')
        .parse();
    const root = findRoot();
    const scanPath = argv.scan
        ? resolveScanPath(root, String(argv.scan))
        : await pickScan(root);
    const scan = readScanFile(scanPath);
    const outDir = path.resolve(root, String(argv.output || DEFAULT_OUT_DIR));
    const pages = buildPages(scan);
    if (pages.length === 0 || !(scan.links || []).length) {
        throw new Error('El escaneo no contiene elementos para generar pruebas. Ejecuta un escaneo con más profundidad.');
    }
    const tipos = String(scan.scanMeta?.elementType || '')
        .split(',')
        .map((tipo) => tipo.trim().toLowerCase())
        .filter(Boolean);
    const customSelector = tipos.includes('custom') ? scan.scanMeta?.selector : undefined;
    const useBrowserStack = Boolean(argv.browserstack);
    if (useBrowserStack && !(0, browserstack_1.hasBrowserStackCredentials)()) {
        throw new Error('BrowserStack requiere BROWSERSTACK_USERNAME y BROWSERSTACK_ACCESS_KEY en src/.env. ' +
            'No necesitas configurar nada más.');
    }
    const buildName = useBrowserStack
        ? (String(process.env.CACHAI_BROWSERSTACK_BUILD || '').trim() || (0, browserstack_1.browserStackBuildName)())
        : '';
    if (useBrowserStack)
        process.env.CACHAI_BROWSERSTACK_BUILD = buildName;
    const rawBrowsers = String(argv.browsers || (useBrowserStack ? 'chromium,firefox,webkit' : 'chromium,firefox,chrome'));
    const browsers = parseBrowsers(rawBrowsers, useBrowserStack);
    const workers = Math.max(1, Math.min(32, Math.floor(Number(argv.workers) || 5)));
    const maxLinks = Math.max(1, Math.min(500, Math.floor(Number(argv.maxLinks) || DEFAULT_MAX_LINKS_PER_PAGE)));
    const localTarget = useBrowserStack && (0, browserstack_1.isLocalTargetUrl)(scan.baseUrl);
    const seenLinks = new Set();
    const pageSpecs = pages
        .map((page) => buildPageScenarios(page, customSelector, seenLinks, {
        maxLinks,
        // Los enlaces se comprueban una sola vez: se usa el primer navegador configurado.
        linkBrowser: browsers[0].name
    }))
        .filter((page) => page.scenarios.length > 0);
    const totalTests = pageSpecs.reduce((sum, page) => sum + page.scenarios.length, 0);
    if (totalTests === 0) {
        throw new Error('No se pudo generar ningún escenario a partir del escaneo.');
    }
    const generatedAt = new Date().toISOString();
    const specPath = path.join(outDir, SPEC_NAME);
    const featurePath = path.join(outDir, FEATURE_NAME);
    const configPath = path.join(outDir, CONFIG_NAME);
    const stepsPath = path.join(outDir, STEPS_NAME);
    const reportFolder = path.join(root, REPORT_ROOT, `playwright-report-${slugDate()}`);
    const resultsFile = path.join(root, REPORT_ROOT, 'results.json');
    fs.mkdirSync(outDir, { recursive: true });
    const scanRel = toPosix(path.relative(root, scanPath));
    const specContent = buildSpecFile(pageSpecs, {
        scanPath: scanRel,
        generatedAt,
        totalTests,
        browserstack: useBrowserStack
    });
    fs.writeFileSync(specPath, specContent, 'utf8');
    fs.writeFileSync(featurePath, buildFeatureFile(scan, pageSpecs), 'utf8');
    // Los pasos BDD se regeneran junto con el .feature para que siempre coincidan
    // con el Gherkin en lenguaje natural generado.
    fs.writeFileSync(stepsPath, cucumber_steps_template_1.CUCUMBER_STEPS_TEMPLATE, 'utf8');
    if (useBrowserStack) {
        fs.writeFileSync(path.join(outDir, BROWSERSTACK_FIXTURE_NAME), buildBrowserStackFixture(), 'utf8');
    }
    fs.writeFileSync(configPath, buildConfigFile(toPosix(reportFolder), toPosix(resultsFile), Number(argv.timeout) || 60000, browsers, workers, useBrowserStack, buildName), 'utf8');
    if (useBrowserStack) {
        writeBrowserStackMetadata(reportFolder, {
            buildName,
            targetUrl: scan.baseUrl,
            local: localTarget,
            browsers: browsers.map((browser) => browser.name),
            generatedAt
        });
    }
    let host = 'sitio';
    try {
        host = new URL(scan.baseUrl).hostname.replace(/^www\./, '');
    }
    catch {
        // Mantener el valor por defecto
    }
    const summaryPath = path.join(root, REPORT_ROOT, `${host}-${slugDate()}.json`);
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.writeFileSync(summaryPath, JSON.stringify(buildSummary(scan, scanPath, pages, pageSpecs, {
        browsers: browsers.map((browser) => browser.name),
        workers,
        maxLinks,
        root
    }), null, 2), 'utf8');
    console.log('');
    console.log('='.repeat(58));
    console.log('  PRUEBAS GENERADAS DESDE EL ESCANEO');
    console.log('='.repeat(58));
    console.log(`Escaneo:      ${scanRel}`);
    console.log(`Sitio:        ${scan.baseUrl}`);
    console.log(`Páginas:      ${pageSpecs.length}`);
    console.log(`Escenarios:   ${totalTests} (lenguaje natural / BDD)`);
    console.log(`Entorno:      ${useBrowserStack ? 'BrowserStack (nube)' : 'Local'}`);
    console.log(`Navegadores:  ${browsers.map((browser) => browser.name).join(', ')}`);
    console.log(`Workers:      ${useBrowserStack ? 1 : workers}`);
    if (useBrowserStack) {
        console.log(`Build:        ${buildName}`);
        if (localTarget) {
            console.log('Túnel local:  BrowserStack Local automático (para localhost/red privada)');
        }
    }
    console.log(`Enlaces/pág:  ${maxLinks} (los enlaces se comprueban una sola vez, en ${browsers[0].name})`);
    console.log(`Spec:         ${toPosix(path.relative(root, specPath))}`);
    console.log(`Gherkin:      ${toPosix(path.relative(root, featurePath))}`);
    console.log(`Pasos BDD:    ${toPosix(path.relative(root, stepsPath))}`);
    console.log(`Config:       ${toPosix(path.relative(root, configPath))}`);
    console.log(`Resumen JSON: ${toPosix(path.relative(root, summaryPath))}`);
    const scanErrors = scan.errors?.length || 0;
    const scanDownloads = scan.downloads?.length || 0;
    const scanInvalid = scan.invalidLinks?.length || 0;
    if (scanErrors + scanDownloads + scanInvalid > 0) {
        console.log(`Incidencias del escaneo: ${scanErrors + scanDownloads + scanInvalid}`);
        if (scanErrors > 0)
            console.log(`  Errores de navegación: ${scanErrors}`);
        if (scanDownloads > 0)
            console.log(`  Descargas omitidas: ${scanDownloads}`);
        if (scanInvalid > 0)
            console.log(`  Enlaces inválidos: ${scanInvalid}`);
    }
    console.log('');
    const interactive = Boolean(process.stdin.isTTY) && Boolean(argv.prompt);
    let shouldRun = Boolean(argv.run);
    if (!argv.run && interactive) {
        const answer = await ask('¿Ejecutar las pruebas ahora? [S/N]: ');
        shouldRun = /^(s|si|sí|y|yes)$/i.test(answer);
    }
    let exitCode = 0;
    if (shouldRun) {
        let tunnel;
        try {
            if (useBrowserStack && localTarget) {
                console.log('');
                console.log('Iniciando BrowserStack Local para acceder al sitio local...');
                tunnel = await (0, browserstack_1.startBrowserStackLocal)(buildName);
                process.env.CACHAI_BROWSERSTACK_LOCAL_IDENTIFIER = tunnel.identifier;
            }
            exitCode = runPlaywright(outDir, {
                browserstack: useBrowserStack,
                buildName,
                local: localTarget,
                localIdentifier: tunnel ? tunnel.identifier : undefined
            });
        }
        finally {
            if (tunnel) {
                await tunnel.stop();
                delete process.env.CACHAI_BROWSERSTACK_LOCAL_IDENTIFIER;
            }
        }
        // El reporter HTML puede limpiar su carpeta; se reescribe después de correr.
        if (useBrowserStack) {
            writeBrowserStackMetadata(reportFolder, {
                buildName,
                targetUrl: scan.baseUrl,
                local: localTarget,
                browsers: browsers.map((browser) => browser.name),
                generatedAt
            });
        }
        console.log('');
        const reportIndex = `${toPosix(path.relative(root, reportFolder))}/index.html`;
        if (exitCode === 0) {
            console.log(`Pruebas completadas sin fallos. Reporte HTML: ${reportIndex}`);
        }
        else {
            console.log(`Algunas pruebas fallaron (código ${exitCode}). Reporte HTML: ${reportIndex}`);
        }
        if (useBrowserStack) {
            console.log(`Sesiones BrowserStack: ${(0, browserstack_1.browserStackDashboardUrl)(buildName)}`);
        }
    }
    else {
        console.log('Pruebas generadas sin ejecutar. Podrás ejecutarlas desde el panel web.');
    }
    if (interactive && argv.open) {
        const answer = await ask('¿Abrir el panel web (Dashboard) ahora? [S/N]: ');
        if (/^(s|si|sí|y|yes)$/i.test(answer)) {
            openDashboard(root);
        }
    }
    console.log('');
    process.exitCode = exitCode;
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n[ERROR] ${message}\n`);
    process.exitCode = 1;
});
//# sourceMappingURL=from-scan.js.map