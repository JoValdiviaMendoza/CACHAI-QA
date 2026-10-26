#!/usr/bin/env node
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

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { spawn, spawnSync, exec } from 'child_process';

// ============================================
// Constantes
// ============================================

const SCAN_DIR = 'scan-report';
const REPORT_ROOT = 'reports';
const DEFAULT_OUT_DIR = path.join(REPORT_ROOT, 'generated-tests');
const SPEC_NAME = 'cachai-tests.spec.ts';
const FEATURE_NAME = 'cachai-tests.feature';
const CONFIG_NAME = 'playwright.config.ts';

const MAX_LINKS_PER_PAGE = 120;
const MAX_IMAGES_PER_PAGE = 80;
const MAX_BUTTONS_PER_PAGE = 10;

// ============================================
// Tipos
// ============================================

interface ScanElement {
  url?: string;
  text?: string;
  isInternal?: boolean;
  sourceUrl?: string;
  parentUrl?: string;
  depth?: number;
  tagName?: string;
  type?: string;
  selector?: string;
}

interface ScanMeta {
  elementType?: string;
  selector?: string;
  depth?: number;
  maxPages?: number;
  concurrency?: number;
}

interface ScanFile {
  baseUrl: string;
  timestamp?: string;
  totalPages?: number;
  totalLinks?: number;
  links?: ScanElement[];
  errors?: string[];
  scanMeta?: ScanMeta;
}

interface ElementRow {
  url: string;
  text: string;
}

interface PageModel {
  url: string;
  links: ElementRow[];
  images: ElementRow[];
  forms: ElementRow[];
  buttons: ElementRow[];
  custom: ElementRow[];
}

type ScenarioType =
  | 'navigation'
  | 'broken-link'
  | 'image-load'
  | 'form-validation'
  | 'button-click'
  | 'custom';

type ScenarioPriority = 'critical' | 'high' | 'medium' | 'low';

interface Scenario {
  type: ScenarioType;
  priority: ScenarioPriority;
  title: string;
  scenario: string;
  gherkin: string[];
  fixtures: 'page' | 'request';
  body: string[];
}

interface PageScenarios {
  url: string;
  label: string;
  scenarios: Scenario[];
}

// ============================================
// Utilidades de sistema
// ============================================

function findRoot(): string {
  const candidates = [
    process.cwd(),
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '..', '..')
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
  }
  return process.cwd();
}

function statMtime(file: string): number {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

function formatDate(ms: number): string {
  if (!ms) return 'sin fecha';
  try {
    return new Date(ms).toLocaleString('es-CL');
  } catch {
    return 'sin fecha';
  }
}

function slugDate(date: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

/** Escapa un texto para incrustarlo como string literal en el spec generado. */
function esc(value: string): string {
  return "'" + String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ')
    .replace(/\u2028|\u2029/g, ' ') + "'";
}

function ask(query: string): Promise<string> {
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

function readScanFile(file: string): ScanFile {
  let text = fs.readFileSync(file, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const data = JSON.parse(text) as ScanFile;
  if (!data || typeof data !== 'object' || !data.baseUrl || !Array.isArray(data.links)) {
    throw new Error(`El archivo no tiene el formato de un escaneo de CACHAI-QA: ${file}`);
  }
  return data;
}

function listScans(root: string): string[] {
  const dir = path.join(root, SCAN_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .map((name) => path.join(dir, name))
    .sort((a, b) => statMtime(b) - statMtime(a));
}

function describeScan(file: string): string {
  try {
    const scan = readScanFile(file);
    const parts: string[] = [scan.baseUrl];
    if (typeof scan.totalPages === 'number') parts.push(`${scan.totalPages} pág.`);
    if (Array.isArray(scan.links)) parts.push(`${scan.links.length} elem.`);
    return parts.join(' · ');
  } catch {
    return '(JSON ilegible)';
  }
}

function resolveScanPath(root: string, input: string): string {
  const candidates = [
    path.resolve(root, input),
    path.resolve(root, SCAN_DIR, input)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`No se encontró el escaneo indicado: ${input}`);
}

async function pickScan(root: string): Promise<string> {
  const files = listScans(root);
  if (files.length === 0) {
    throw new Error(`No hay escaneos en ${SCAN_DIR}/. Ejecuta primero una opción de escaneo ([1], [2] o [3]).`);
  }
  if (!process.stdin.isTTY) return files[0];

  const shown = files.slice(0, 15);
  console.log('Escaneos disponibles:\n');
  shown.forEach((file, index) => {
    console.log(`  [${index + 1}] ${toPosix(path.relative(root, file))}`);
    console.log(`      ${describeScan(file)} · ${formatDate(statMtime(file))}`);
  });
  console.log('');

  const answer = await ask('Elige un escaneo [Enter = el más reciente]: ');
  if (!answer) return shown[0];
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

function normalizeUrl(raw: string, base?: string): string {
  try {
    const parsed = new URL(raw, base);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return raw;
  }
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function pageLabelOf(url: string): string {
  try {
    const parsed = new URL(url);
    const label = `${parsed.pathname}${parsed.search}`;
    return label === '' ? '/' : label;
  } catch {
    return url;
  }
}

function kindOf(element: ScanElement): 'link' | 'image' | 'form' | 'button' | 'other' {
  const tag = String(element.tagName || '').toLowerCase();
  if (tag === 'a') return 'link';
  if (tag === 'img') return 'image';
  if (tag === 'form') return 'form';
  if (tag === 'input' || tag === 'button') return 'button';
  return 'other';
}

function pushUnique(target: ElementRow[], row: ElementRow): void {
  if (target.some((item) => item.url === row.url && item.text === row.text)) return;
  target.push(row);
}

function buildPages(scan: ScanFile): PageModel[] {
  const pages = new Map<string, PageModel>();

  const getPage = (url: string): PageModel => {
    let page = pages.get(url);
    if (!page) {
      page = { url, links: [], images: [], forms: [], buttons: [], custom: [] };
      pages.set(url, page);
    }
    return page;
  };

  for (const element of scan.links || []) {
    if (!element || typeof element !== 'object') continue;

    // Los escaneos nuevos traen `sourceUrl` (pagina donde se encontro el elemento).
    // Los antiguos solo tienen `parentUrl`, por lo que se usa como aproximacion.
    const pageUrl = normalizeUrl(element.sourceUrl || element.parentUrl || scan.baseUrl, scan.baseUrl);
    if (!isHttpUrl(pageUrl)) continue;

    const target = normalizeUrl(String(element.url || ''), pageUrl);
    const page = getPage(pageUrl);
    const text = String(element.text || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    const kind = kindOf(element);

    if (kind === 'link') {
      if (!isHttpUrl(target)) continue;
      if (element.isInternal === false) continue; // Solo enlaces internos
      pushUnique(page.links, { url: target, text: text || target });
    } else if (kind === 'image') {
      if (!isHttpUrl(target)) continue;
      pushUnique(page.images, { url: target, text });
    } else if (kind === 'form') {
      pushUnique(page.forms, { url: pageUrl, text: text || 'formulario' });
    } else if (kind === 'button') {
      pushUnique(page.buttons, { url: target, text: text || 'botón' });
    } else if (target && isHttpUrl(target)) {
      pushUnique(page.custom, { url: target, text });
    }
  }

  return Array.from(pages.values());
}

// ============================================
// Generacion de escenarios (lenguaje natural)
// ============================================

function loadScenario(page: PageModel): Scenario {
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

function linksScenario(page: PageModel): Scenario | null {
  const links = page.links.slice(0, MAX_LINKS_PER_PAGE);
  if (links.length === 0) return null;

  const label = pageLabelOf(page.url);
  const truncated = page.links.length > links.length
    ? ` (se verifican ${links.length} de ${page.links.length})`
    : '';

  const body: string[] = ['    const enlaces = ['];
  for (const link of links) {
    body.push(`      { texto: ${esc(link.text)}, url: ${esc(link.url)} },`);
  }
  body.push('    ];');
  body.push('');
  body.push('    for (const enlace of enlaces) {');
  body.push('      const respuesta = await request.get(enlace.url, { timeout: 20000, maxRedirects: 10 });');
  body.push('      expect(respuesta.status(), `El enlace «${enlace.texto}» (${enlace.url}) debe responder sin errores`).toBeLessThan(400);');
  body.push('    }');

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

function imagesScenario(page: PageModel): Scenario | null {
  const images = page.images.slice(0, MAX_IMAGES_PER_PAGE);
  if (images.length === 0) return null;

  const label = pageLabelOf(page.url);
  const body: string[] = [
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

function formsScenario(page: PageModel): Scenario | null {
  const forms = page.forms;
  if (forms.length === 0) return null;

  const label = pageLabelOf(page.url);
  const body: string[] = [
    `    await page.goto(${esc(page.url)}, { waitUntil: 'domcontentloaded' });`,
    '',
    "    const formularios = page.locator('form');",
    `    expect(await formularios.count(), 'La página debe contener los formularios escaneados').toBeGreaterThanOrEqual(${forms.length});`,
    '',
    `    for (let indice = 0; indice < ${forms.length}; indice++) {`,
    '      await expect(formularios.nth(indice), `El formulario #${indice + 1} debe ser visible`).toBeVisible();',
    '    }'
  ];

  return {
    type: 'form-validation',
    priority: 'high',
    title: forms.length === 1
      ? `El formulario de «${label}» está visible y listo para usarse`
      : `Los ${forms.length} formularios de «${label}» están visibles y listos para usarse`,
    scenario: `Formularios de «${label}»`,
    gherkin: [
      `Dado que un usuario visita "${page.url}"`,
      forms.length === 1
        ? 'Cuando busca el formulario de la página'
        : `Cuando busca los ${forms.length} formularios de la página`,
      'Entonces todos deben estar presentes y visibles para el usuario'
    ],
    fixtures: 'page',
    body
  };
}

function buttonsScenario(page: PageModel): Scenario | null {
  const buttons = page.buttons.slice(0, MAX_BUTTONS_PER_PAGE);
  if (buttons.length === 0) return null;

  const label = pageLabelOf(page.url);
  const indices = buttons.map((_button, index) => index);
  const body: string[] = [
    `    await page.goto(${esc(page.url)}, { waitUntil: 'domcontentloaded' });`,
    '',
    "    const botones = page.locator('button, input[type=\"button\"], input[type=\"submit\"], input[type=\"reset\"], a[role=\"button\"]');",
    `    expect(await botones.count(), 'La página debe contener los botones escaneados').toBeGreaterThanOrEqual(${buttons.length});`,
    '',
    `    for (const indice of [${indices.join(', ')}]) {`,
    '      await expect(botones.nth(indice), `El botón #${indice + 1} debe ser visible`).toBeVisible();',
    '      await expect(botones.nth(indice), `El botón #${indice + 1} debe estar habilitado`).toBeEnabled();',
    '    }'
  ];

  return {
    type: 'button-click',
    priority: 'medium',
    title: buttons.length === 1
      ? `El botón de «${label}» es visible y está habilitado`
      : `Los ${buttons.length} botones de «${label}» son visibles y están habilitados`,
    scenario: `Botones principales de «${label}»`,
    gherkin: [
      `Dado que un usuario visita "${page.url}"`,
      buttons.length === 1
        ? 'Cuando revisa el botón de la página'
        : `Cuando revisa los ${buttons.length} botones de la página`,
      'Entonces todos deben ser visibles y estar habilitados'
    ],
    fixtures: 'page',
    body
  };
}

function customScenario(page: PageModel, selector: string): Scenario | null {
  const elements = page.custom;
  if (elements.length === 0) return null;

  const label = pageLabelOf(page.url);
  const mensajeSelector = esc(`El selector «${selector}» debe encontrar elementos`);
  const body: string[] = [
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

function buildPageScenarios(page: PageModel, customSelector?: string): PageScenarios {
  const scenarios: Scenario[] = [loadScenario(page)];

  const links = linksScenario(page);
  if (links) scenarios.push(links);

  const images = imagesScenario(page);
  if (images) scenarios.push(images);

  const forms = formsScenario(page);
  if (forms) scenarios.push(forms);

  const buttons = buttonsScenario(page);
  if (buttons) scenarios.push(buttons);

  if (customSelector) {
    const custom = customScenario(page, customSelector);
    if (custom) scenarios.push(custom);
  }

  return { url: page.url, label: pageLabelOf(page.url), scenarios };
}

// ============================================
// Render de archivos
// ============================================

function buildSpecFile(pageSpecs: PageScenarios[], meta: { scanPath: string; generatedAt: string; totalTests: number }): string {
  const lines: string[] = [];
  lines.push('// Auto-generado por CACHAI-QA — no editar a mano.');
  lines.push(`// Escaneo: ${meta.scanPath}`);
  lines.push(`// Generado: ${meta.generatedAt}`);
  lines.push(`// Páginas: ${pageSpecs.length} · Escenarios: ${meta.totalTests}`);
  lines.push('');
  lines.push("import { test, expect } from '@playwright/test';");
  lines.push('');

  const usedTitles = new Set<string>();

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
      for (const step of scenario.gherkin) lines.push(`   *   ${step}`);
      lines.push('   */');
      lines.push(`  test(${esc(title)}, async ({ ${scenario.fixtures} }) => {`);
      for (const bodyLine of scenario.body) lines.push(bodyLine);
      lines.push('  });');
      lines.push('');
    }

    lines.push('});');
    lines.push('');
  }

  return lines.join('\n');
}

function buildFeatureFile(scan: ScanFile, pageSpecs: PageScenarios[]): string {
  const lines: string[] = [];
  let host = scan.baseUrl;
  try {
    host = new URL(scan.baseUrl).host;
  } catch {
    // Mantener baseUrl como referencia
  }

  lines.push('# language: es');
  lines.push(`Característica: Calidad del sitio ${host}`);
  lines.push(`  Escaneo realizado sobre "${scan.baseUrl}"${scan.timestamp ? ` el ${scan.timestamp}` : ''}.`);
  lines.push('');

  for (const page of pageSpecs) {
    for (const scenario of page.scenarios) {
      lines.push(`  Escenario: ${scenario.scenario}`);
      for (const step of scenario.gherkin) lines.push(`    ${step}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function buildConfigFile(reportFolder: string, resultsFile: string, timeout: number, browsers: string[]): string {
  const projects = browsers
    .map((browser) => `{ name: ${esc(browser)}, use: { browserName: ${esc(browser)} } }`)
    .join(', ');

  return [
    "import { defineConfig } from '@playwright/test';",
    '',
    'export default defineConfig({',
    "  testDir: '.',",
    `  testMatch: ${esc(SPEC_NAME)},`,
    `  timeout: ${timeout},`,
    '  retries: 0,',
    '  fullyParallel: false,',
    '  workers: 1,',
    '  use: {',
    '    headless: true,',
    '    viewport: { width: 1366, height: 768 },',
    "    trace: 'on-first-retry',",
    "    screenshot: 'only-on-failure',",
    "    video: 'retain-on-failure'",
    '  },',
    `  projects: [${projects}],`,
    `  reporter: [['html', { outputFolder: ${esc(reportFolder)}, open: 'never' }], ['json', { outputFile: ${esc(resultsFile)} }]]`,
    '});',
    ''
  ].join('\n');
}

function buildSummary(
  scan: ScanFile,
  scanPath: string,
  pages: PageModel[],
  pageSpecs: PageScenarios[],
  options: { browsers: string[]; root: string }
): Record<string, unknown> {
  const tests = pageSpecs.flatMap((page) =>
    page.scenarios.map((scenario, index) => ({
      id: `${scenario.type}-${String(index + 1).padStart(3, '0')}`,
      name: scenario.title,
      type: scenario.type,
      priority: scenario.priority,
      page: page.url
    }))
  );

  const counter = (value: number | undefined, fallback: number): number =>
    typeof value === 'number' ? value : fallback;

  return {
    metadata: {
      timestamp: new Date().toISOString(),
      targetUrl: scan.baseUrl,
      mode: 'local',
      pagesScanned: pages.length,
      testsGenerated: tests.length,
      scanSource: toPosix(path.relative(options.root, scanPath)),
      scanTimestamp: scan.timestamp || null,
      config: {
        elementType: scan.scanMeta?.elementType || 'links',
        depth: counter(scan.scanMeta?.depth, 0),
        maxPages: counter(scan.scanMeta?.maxPages, pages.length),
        browsers: options.browsers
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

function runPlaywright(outDir: string): number {
  console.log('');
  console.log('Ejecutando las pruebas con Playwright...');
  console.log('');

  const result = spawnSync('npx', ['playwright', 'test', '--config', CONFIG_NAME], {
    cwd: outDir,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' }
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
function openDashboard(root: string, port: number = 4321): void {
  console.log(`Abriendo el panel web en http://localhost:${port} (o el siguiente puerto libre)...`);

  if (process.platform === 'win32') {
    // `start` abre una consola propia para poder cerrar el panel sin matar esta sesión.
    exec('start "CACHAI-QA - Panel Web" cmd /k node dashboard\\server.js', { cwd: root }, () => {
      // El panel queda corriendo en su propia ventana.
    });
    return;
  }

  spawn('node', ['dashboard/server.js'], {
    cwd: root,
    detached: true,
    stdio: 'ignore'
  }).unref();
}

// ============================================
// Main
// ============================================

async function main(): Promise<void> {
  const yargsModule = await import('yargs');
  const { hideBin } = await import('yargs/helpers');
  const yargsFn = (yargsModule as unknown as { default?: unknown }).default || yargsModule;

  const argv = await (yargsFn as (args: string[]) => any)(hideBin(process.argv))
    .option('scan', { alias: 's', type: 'string', describe: 'Archivo JSON de escaneo (por defecto: el más reciente)' })
    .option('run', { alias: 'r', type: 'boolean', default: false, describe: 'Ejecutar las pruebas después de generarlas' })
    .option('output', { alias: 'o', type: 'string', describe: 'Carpeta de salida de las pruebas' })
    .option('browsers', { type: 'string', default: 'chromium', describe: 'Navegadores separados por coma (ej: chromium,firefox)' })
    .option('timeout', { type: 'number', default: 60000, describe: 'Timeout por prueba (ms)' })
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

  const pageSpecs = pages
    .map((page) => buildPageScenarios(page, customSelector))
    .filter((page) => page.scenarios.length > 0);

  const totalTests = pageSpecs.reduce((sum, page) => sum + page.scenarios.length, 0);
  if (totalTests === 0) {
    throw new Error('No se pudo generar ningún escenario a partir del escaneo.');
  }

  const generatedAt = new Date().toISOString();
  const specPath = path.join(outDir, SPEC_NAME);
  const featurePath = path.join(outDir, FEATURE_NAME);
  const configPath = path.join(outDir, CONFIG_NAME);
  const reportFolder = path.join(root, REPORT_ROOT, `playwright-report-${slugDate()}`);
  const resultsFile = path.join(root, REPORT_ROOT, 'results.json');

  const browsers = String(argv.browsers || 'chromium')
    .split(',')
    .map((browser) => browser.trim().toLowerCase())
    .filter(Boolean)
    .map((browser) => (browser === 'chrome' || browser === 'edge' ? 'chromium' : browser === 'safari' ? 'webkit' : browser));

  fs.mkdirSync(outDir, { recursive: true });

  const scanRel = toPosix(path.relative(root, scanPath));
  const specContent = buildSpecFile(pageSpecs, { scanPath: scanRel, generatedAt, totalTests });
  fs.writeFileSync(specPath, specContent, 'utf8');
  fs.writeFileSync(featurePath, buildFeatureFile(scan, pageSpecs), 'utf8');
  fs.writeFileSync(
    configPath,
    buildConfigFile(toPosix(reportFolder), toPosix(resultsFile), Number(argv.timeout) || 60000, browsers),
    'utf8'
  );

  let host = 'sitio';
  try {
    host = new URL(scan.baseUrl).hostname.replace(/^www\./, '');
  } catch {
    // Mantener el valor por defecto
  }

  const summaryPath = path.join(root, REPORT_ROOT, `${host}-${slugDate()}.json`);
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(buildSummary(scan, scanPath, pages, pageSpecs, { browsers, root }), null, 2),
    'utf8'
  );

  console.log('');
  console.log('='.repeat(58));
  console.log('  PRUEBAS GENERADAS DESDE EL ESCANEO');
  console.log('='.repeat(58));
  console.log(`Escaneo:      ${scanRel}`);
  console.log(`Sitio:        ${scan.baseUrl}`);
  console.log(`Páginas:      ${pageSpecs.length}`);
  console.log(`Escenarios:   ${totalTests} (lenguaje natural / BDD)`);
  console.log(`Spec:         ${toPosix(path.relative(root, specPath))}`);
  console.log(`Gherkin:      ${toPosix(path.relative(root, featurePath))}`);
  console.log(`Config:       ${toPosix(path.relative(root, configPath))}`);
  console.log(`Resumen JSON: ${toPosix(path.relative(root, summaryPath))}`);
  if (scan.errors && scan.errors.length > 0) {
    console.log(`Errores del escaneo: ${scan.errors.length} (revisa el JSON original)`);
  }
  console.log('');

  const interactive = Boolean(process.stdin.isTTY);
  let shouldRun = Boolean(argv.run);

  if (!argv.run && interactive) {
    const answer = await ask('¿Ejecutar las pruebas ahora? [S/N]: ');
    shouldRun = /^(s|si|sí|y|yes)$/i.test(answer);
  }

  let exitCode = 0;

  if (shouldRun) {
    exitCode = runPlaywright(outDir);
    console.log('');
    const reportIndex = `${toPosix(path.relative(root, reportFolder))}/index.html`;
    if (exitCode === 0) {
      console.log(`Pruebas completadas sin fallos. Reporte HTML: ${reportIndex}`);
    } else {
      console.log(`Algunas pruebas fallaron (código ${exitCode}). Reporte HTML: ${reportIndex}`);
    }
  } else {
    console.log('Pruebas generadas sin ejecutar. Podrás ejecutarlas desde el panel web.');
  }

  if (interactive) {
    const answer = await ask('¿Abrir el panel web (Dashboard) ahora? [S/N]: ');
    if (/^(s|si|sí|y|yes)$/i.test(answer)) {
      openDashboard(root);
    }
  }

  console.log('');
  process.exitCode = exitCode;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n[ERROR] ${message}\n`);
  process.exitCode = 1;
});
