#!/usr/bin/env node
/**
 * CACHAI-QA - Advanced Crawler Script
 * Uso: npx ts-node crawler.ts --url=https://ejemplo.com [opciones]
 */

import { chromium, Browser, Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

// Carpeta donde se guardan los JSON de cada escaneo
const SCAN_REPORT_DIR = 'scan-report';

// ============================================
// Interfaces
// ============================================

type ElementType = 'links' | 'images' | 'forms' | 'buttons' | 'all' | 'custom';

interface CrawlOptions {
  url: string;
  depth: number;
  maxPages: number;
  headless: boolean;
  output: string;
  verbose: boolean;
  delay: number;
  concurrency: number;
  includePatterns: string[];
  excludePatterns: string[];
  full: boolean;
  selector: string;
  elementType: ElementType;
}

interface LinkInfo {
  url: string;
  text: string;
  statusCode?: number;
  isInternal: boolean;
  parentUrl: string;
  depth: number;
}

interface CrawlResult {
  baseUrl: string;
  timestamp: string;
  totalPages: number;
  totalLinks: number;
  links: LinkInfo[];
  errors: string[];
}

interface QueuedUrl {
  url: string;
  depth: number;
  parentUrl: string;
}

// ============================================
// Utilidades
// ============================================

function normalizeUrl(url: string, base: string): string {
  try {
    const parsed = new URL(url, base);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function isInternalUrl(url: string, baseHostname: string): boolean {
  try {
    return new URL(url).hostname === baseHostname;
  } catch {
    return false;
  }
}

function shouldIgnoreUrl(url: string): boolean {
  const ignorePatterns = [
    /\.pdf$/i, /\.zip$/i, /\.exe$/i, /\.dmg$/i,
    /mailto:/i, /tel:/i, /javascript:/i,
    /#.*$/, /\?.*utm_source=/i
  ];
  return ignorePatterns.some(p => p.test(url));
}

function matchesPatterns(url: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true;
  return patterns.some(pattern => {
    try {
      const regex = new RegExp(pattern);
      return regex.test(url);
    } catch {
      return url.includes(pattern);
    }
  });
}

function shouldExcludeUrl(url: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  return patterns.some(pattern => {
    try {
      const regex = new RegExp(pattern);
      return regex.test(url);
    } catch {
      return url.includes(pattern);
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// Barra de progreso (sin dependencias externas)
// ============================================

interface ProgressStats {
  pages: number;
  links: number;
  errors: number;
  queued: number;
}

class Progress {
  private timer: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private lastLen = 0;
  private readonly tty: boolean;

  constructor(private readonly stats: () => ProgressStats) {
    this.tty = Boolean((process.stdout as any) && (process.stdout as any).isTTY);
  }

  start(): void {
    if (!this.tty) return;
    this.timer = setInterval(() => this.render(), 120);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.clearLine();
  }

  private clearLine(): void {
    if (!this.tty || this.lastLen === 0) return;
    process.stdout.write('\r' + ' '.repeat(this.lastLen) + '\r');
    this.lastLen = 0;
  }

  private render(): void {
    if (!this.tty) return;
    const s = this.stats();
    const width = 24;
    const period = width * 2;
    const pos = this.frame % period;
    const fill = pos <= width ? pos : period - pos;
    const bar = '='.repeat(fill) + '-'.repeat(width - fill);
    const line = `  [${bar}]  ${s.pages} paginas | ${s.links} enlaces | ${s.errors} errores | cola ${s.queued}`;
    const padded = line + ' '.repeat(Math.max(0, this.lastLen - line.length));
    process.stdout.write('\r' + padded);
    this.lastLen = line.length;
    this.frame++;
  }

  /** Imprime texto por encima de la barra sin romperla. */
  log(text: string): void {
    this.clearLine();
    process.stdout.write(text + '\n');
    this.render();
  }
}

function generateFilenameFromUrl(url: string): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return `${hostname}-${ts}.json`;
  } catch {
    return `crawl-${ts}.json`;
  }
}

const ELEMENT_SELECTORS: Record<string, string> = {
  links: 'a[href]',
  images: 'img[src]',
  forms: 'form',
  buttons: 'button, input[type="button"], input[type="submit"], input[type="reset"], a[role="button"]'
};

function getSelectorForElementType(type: string, customSelector: string): string {
  const types = String(type || 'links')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (types.includes('all')) {
    return Object.keys(ELEMENT_SELECTORS).map((k) => ELEMENT_SELECTORS[k]).join(', ');
  }
  if (types.includes('custom')) {
    return customSelector || ELEMENT_SELECTORS.links;
  }

  const parts = types
    .map((t) => ELEMENT_SELECTORS[t])
    .filter((s): s is string => Boolean(s));

  return parts.length > 0 ? parts.join(', ') : ELEMENT_SELECTORS.links;
}

const ELEMENT_LABELS: Record<string, string> = {
  links: 'Enlaces (a[href])',
  images: 'Imagenes (img[src])',
  forms: 'Formularios (form)',
  buttons: 'Botones (button, input[type=button/submit/reset], a[role=button])',
  all: 'Todo (links, images, forms, buttons)',
  custom: 'Selector personalizado'
};

function getElementTypeDescription(type: string): string {
  const types = String(type || '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (types.length === 0) return ELEMENT_LABELS.links;
  if (types.includes('all')) return ELEMENT_LABELS.all;

  const labels = types.map((t) => ELEMENT_LABELS[t]).filter(Boolean);
  return labels.length > 0 ? labels.join(' + ') : ELEMENT_LABELS.links;
}

// ============================================
// Crawler Principal con Paralelismo
// ============================================

class SimpleCrawler {
  private browser: any = null;
  private context: any = null;
  private options: any;
  private baseHostname: string;
  private visited = new Set<string>();
  private queue: any[] = [];
  private results: any[] = [];
  private errors: string[] = [];
  private pageCount = 0;
  private activeWorkers = 0;
  private cancelled = false;
  private progress: Progress | null = null;

  constructor(options: any) {
    this.options = options;
    this.baseHostname = new URL(options.url).hostname;
    this.queue.push({ url: options.url, depth: 0, parentUrl: '' });
  }

  private log(text: string): void {
    if (this.progress) this.progress.log(text);
    else console.log(text);
  }

  async run(): Promise<any> {
    console.log(`Iniciando crawler en: ${this.options.url}`);
    console.log(`Profundidad: ${this.options.depth} | Max paginas: ${this.options.maxPages} | Concurrencia: ${this.options.concurrency} | Headless: ${this.options.headless}`);

    if (this.options.includePatterns.length > 0) {
      console.log(`Incluir patrones: ${this.options.includePatterns.join(', ')}`);
    }
    if (this.options.excludePatterns.length > 0) {
      console.log(`Excluir patrones: ${this.options.excludePatterns.join(', ')}`);
    }
    if (this.options.selector !== 'a[href]') {
      console.log(`Selector personalizado: ${this.options.selector}`);
    }
    if (this.options.elementType !== 'links') {
      console.log(`Tipo de elementos: ${getElementTypeDescription(this.options.elementType)}`);
    }
    console.log('');

    await this.initBrowser();

    const progress = new Progress(() => ({
      pages: this.pageCount,
      links: this.results.length,
      errors: this.errors.length,
      queued: this.queue.length
    }));
    this.progress = progress;
    progress.start();

    this.cancelled = false;
    const handleInterrupt = () => {
      this.cancelled = true;
      this.log('\nCancelando crawler... esperando a los workers activos');
    };
    process.on('SIGINT', handleInterrupt);

    try {
      await this.processQueue();

      if (this.cancelled) {
        this.log('\nCancelado por el usuario. Paginas escaneadas: ' + this.pageCount);
      }

    } finally {
      process.off('SIGINT', handleInterrupt);
      this.progress?.stop();
      this.progress = null;
      await this.closeBrowser();
    }

    return this.generateReport();
  }

  private async processQueue(): Promise<void> {
    const workers: Promise<void>[] = [];

    for (let i = 0; i < this.options.concurrency; i++) {
      workers.push(this.worker());
    }

    await Promise.all(workers);
  }

  private async worker(): Promise<void> {
    while (!this.cancelled) {
      if (this.pageCount >= this.options.maxPages) break;

      const item = this.queue.shift();
      if (!item) {
        // Cola vacia: si otros workers siguen procesando, esperar por nuevas URLs
        // (si nadie procesa y la cola esta vacia, no habra mas trabajo)
        if (this.activeWorkers === 0) break;
        await sleep(50);
        continue;
      }

      const { url, depth, parentUrl } = item;

      if (this.visited.has(url)) continue;
      if (depth > this.options.depth) continue;

      if (!matchesPatterns(item.url, this.options.includePatterns)) continue;
      if (shouldExcludeUrl(item.url, this.options.excludePatterns)) continue;

      this.visited.add(url);
      this.pageCount++;
      const pageIndex = this.pageCount;
      this.activeWorkers++;

      let retries = 2;
      let success = false;

      while (retries >= 0 && !success && !this.cancelled) {
        try {
          await this.crawlPage(item.url, depth, parentUrl, pageIndex);
          success = true;
        } catch (error) {
          retries--;
          const msg = error instanceof Error ? error.message : String(error);

          const isNetworkError = msg.includes('ERR_ABORTED') ||
                                msg.includes('net::') ||
                                msg.includes('timeout') ||
                                msg.includes('Execution context was destroyed');

          if (retries >= 0 && isNetworkError) {
            this.log(chalk.yellow(`  Reintentando (${retries + 1}/2) ${url}: ${msg.substring(0, 80)}...`));
            await sleep(1000);
          } else {
            this.errors.push(`${item.url}: ${msg}`);
            this.log(chalk.red(`  Error en ${url}: ${msg.substring(0, 120)}`));
            break;
          }
        }
      }

      this.activeWorkers--;

      if (this.options.delay > 0 && !this.cancelled) {
        await sleep(this.options.delay);
      }
    }
  }

  private async initBrowser(): Promise<void> {
    const { chromium } = require('@playwright/test');
    this.browser = await chromium.launch({
      headless: this.options.headless,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'CACHAI-QA/1.0 (+https://github.com/cachai-qa)'
    });

    this.context.setDefaultTimeout(30000);
    this.context.setDefaultNavigationTimeout(30000);

    await this.context.route('**/*', (route: any) => {
      const type = route.request().resourceType();
      ['font', 'media', 'websocket', 'eventsource', 'manifest'].includes(type)
        ? route.abort()
        : route.continue();
    });
  }

  private async crawlPage(url: string, depth: number, parentUrl: string, pageIndex: number): Promise<void> {
    const page = await this.context!.newPage();

    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      if (!response) {
        throw new Error('Navigation aborted: no response');
      }

      try {
        await page.waitForLoadState('networkidle', { timeout: 10000 });
      } catch {
        // continue
      }

      const selector = getSelectorForElementType(this.options.elementType, this.options.selector);
      const tiposActuales = String(this.options.elementType || '')
        .split(',')
        .map((t: string) => t.trim().toLowerCase());
      const selectorIncludesLinks = tiposActuales.includes('links') || tiposActuales.includes('all');

      let elements: Array<{ href: string; src?: string; text: string; tagName?: string; type?: string; selector: string }> = [];

      try {
        elements = await page.evaluate((sel: any) => {
          return Array.from(document.querySelectorAll(sel))
            .map((el: any, i: number) => {
              const anchor = el;
              const img = el;
              const form = el;
              const button = el;
              const input = el;

              return {
                href: anchor.href || '',
                src: img.src || '',
                text: (el.textContent || input.value || el.getAttribute('value') || '').trim(),
                tagName: el.tagName.toLowerCase(),
                type: input.type || '',
                selector: `${sel}:nth-of-type(${i + 1})`
              };
            });
        }, selector) as Array<{ href: string; src?: string; text: string; tagName?: string; type?: string; selector: string }>;
      } catch (evalError) {
        try {
          elements = await page.$$eval(selector, (elements: any) => {
            return elements.map((el: any, i: number) => {
              const anchor = el;
              const img = el;
              const form = el;
              const button = el;
              const input = el;

              return {
                href: anchor.href || '',
                src: img.src || '',
                text: (el.textContent || input.value || el.getAttribute('value') || '').trim(),
                tagName: el.tagName.toLowerCase(),
                type: input.type || '',
                selector: `nth-of-type(${i + 1})`
              };
            });
          });
        } catch (altError) {
          elements = [];
        }
      }

      const foundLines: string[] = [];
      let newLinks = 0;
      const MAX_LIST = 40;
      let listed = 0;

      for (const element of elements) {
        const rawUrl = element.href || element.src || '';
        const normalized = rawUrl ? normalizeUrl(rawUrl, url) : '';

        if (normalized) {
          if (shouldIgnoreUrl(normalized)) continue;
          if (this.visited.has(normalized)) continue;
          if (!matchesPatterns(normalized, this.options.includePatterns)) continue;
          if (shouldExcludeUrl(normalized, this.options.excludePatterns)) continue;
        }

        const isInternal = normalized ? isInternalUrl(normalized, this.baseHostname) : true;

        this.results.push({
          url: normalized || url,
          text: element.text.substring(0, 200),
          statusCode: isInternal ? undefined : 0,
          isInternal,
          parentUrl,
          depth,
          tagName: element.tagName,
          selector: element.selector
        });
        newLinks++;

        if (this.options.verbose && listed < MAX_LIST) {
          const label = element.text ? ` "${element.text.substring(0, 80)}"` : '';
          const shown = normalized || `(${element.tagName} en esta pagina)`;
          foundLines.push(`     ${isInternal ? '->' : '=>'} ${shown}${label}`);
          listed++;
        }

        if (normalized && isInternal && depth < this.options.depth && element.tagName === 'a') {
          this.queue.push({ url: normalized, depth: depth + 1, parentUrl: url });
        }
      }

      // Para tipos que no incluyen enlaces (imagenes, formularios, botones,
      // selector personalizado) igualmente navegamos el sitio siguiendo <a href>,
      // mostrando solo el tipo elegido.
      if (!selectorIncludesLinks && depth < this.options.depth) {
        try {
          const anchors = await page.$$eval('a[href]', (els: any) =>
            els.map((e: any) => ({ href: e.href || '' }))
          );
          for (const a of anchors) {
            const normalized = normalizeUrl(a.href, url);
            if (!normalized || shouldIgnoreUrl(normalized)) continue;
            if (!isInternalUrl(normalized, this.baseHostname)) continue;
            if (this.visited.has(normalized)) continue;
            if (!matchesPatterns(normalized, this.options.includePatterns)) continue;
            if (shouldExcludeUrl(normalized, this.options.excludePatterns)) continue;
            this.queue.push({ url: normalized, depth: depth + 1, parentUrl: url });
          }
        } catch {
          // Sin enlaces que seguir
        }
      }

      if (this.options.verbose) {
        let block = chalk.cyan(`[${pageIndex}] (depth ${depth}) ${elements.length} elementos | ${newLinks} nuevos | ${url}`);
        if (foundLines.length) block += '\n' + foundLines.join('\n');
        if (newLinks > listed) block += `\n     ... y ${newLinks - listed} enlaces mas`;
        this.log(block);
      } else {
        this.log(`[${pageIndex}] ${url}`);
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.errors.push(`${url}: ${msg}`);
      this.log(chalk.red(`  Error en ${url}: ${msg.substring(0, 120)}`));
    } finally {
      // Cerrar la pestana para no acumular memoria (el contexto se reutiliza)
      await page.close().catch(() => {});
    }
  }

  private async closeBrowser(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
  }

  private generateReport(): any {
    return {
      baseUrl: this.options.url,
      timestamp: new Date().toISOString(),
      totalPages: this.pageCount,
      totalLinks: this.results.length,
      links: this.results,
      errors: this.errors
    };
  }
}

// CLI
async function main() {
  const yargsModule = await import('yargs');
  const { hideBin } = await import('yargs/helpers');
  const yargsFn = yargsModule.default || yargsModule;

  const argv = await yargsFn(hideBin(process.argv))
    .option('url', { alias: 'u', type: 'string', demandOption: true, describe: 'URL inicial para rastrear' })
    .option('depth', { alias: 'd', type: 'number', default: 1, describe: 'Profundidad maxima de rastreo' })
    .option('max-pages', { alias: 'm', type: 'number', default: 50, describe: 'Maximo numero de paginas a visitar' })
    .option('headless', { type: 'boolean', default: true, describe: 'Ejecutar en modo headless' })
    .option('output', { alias: 'o', type: 'string', describe: 'Archivo de salida JSON (por defecto: scan-report/URL-fecha-hora.json)' })
    .option('verbose', { alias: 'v', type: 'boolean', default: false, describe: 'Salida detallada' })
    .option('delay', { type: 'number', default: 500, describe: 'Delay entre requests (ms)' })
    .option('concurrency', { alias: 'c', type: 'number', default: 5, describe: 'Numero de workers paralelos' })
    .option('include', { alias: 'i', type: 'string', array: true, describe: 'Patrones de URL a incluir (regex o substring)' })
    .option('exclude', { alias: 'e', type: 'string', array: true, describe: 'Patrones de URL a excluir (regex o substring)' })
    .option('full', { alias: 'f', type: 'boolean', default: false, describe: 'Modo completo: profundidad y paginas ilimitadas' })
    .option('selector', { alias: 's', type: 'string', default: 'a[href]', describe: 'Selector CSS personalizado (solo para --type=custom)' })
    .option('type', { alias: 't', type: 'string', default: 'links', describe: 'Tipo(s) de elementos a escanear: links, images, forms, buttons, all, custom (varios separados por coma, ej: links,images,forms)' })
    .help()
    .parse();

  let targetUrl: string;
  {
    const rawUrl = String(argv.url ?? '').trim();
    if (!rawUrl) {
      console.error('\n  No ingresaste ninguna URL.');
      console.error('  Ejemplo: books.toscrape.com  o  https://ejemplo.com\n');
      return;
    }
    try {
      const hasProto = /^https?:\/\//i.test(rawUrl);
      const host = rawUrl.split('/')[0].split(':')[0].toLowerCase();
      const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
      const withProto = hasProto ? rawUrl : `${isLocal ? 'http' : 'https'}://${rawUrl}`;
      targetUrl = new URL(withProto).toString();
    } catch {
      console.error(`\n  URL invalida: "${rawUrl}"`);
      console.error('  Escribe un dominio valido, por ejemplo: books.toscrape.com\n');
      return;
    }
    const host = new URL(targetUrl).hostname;
    if (!host.includes('.') && host !== 'localhost' && host !== '127.0.0.1') {
      console.error(`\n  El dominio "${host}" no parece valido (falta un punto, ej: midominio.cl).\n`);
      return;
    }
  }

  const TIPOS_VALIDOS = ['links', 'images', 'forms', 'buttons', 'all', 'custom'];
  const tiposElegidos = String(argv.type || 'links')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const tiposInvalidos = tiposElegidos.filter((t) => !TIPOS_VALIDOS.includes(t));
  if (tiposInvalidos.length > 0) {
    console.error(`\n  Tipo(s) de elemento invalido(s): ${tiposInvalidos.join(', ')}`);
    console.error(`  Validos: ${TIPOS_VALIDOS.join(', ')}\n`);
    return;
  }

  const depth = argv.full ? 999 : argv.depth;
  const maxPages = argv.full ? 999999 : argv['max-pages'];
  const output = argv.output
    ? String(argv.output)
    : path.join(SCAN_REPORT_DIR, generateFilenameFromUrl(targetUrl));

  const options = {
    url: targetUrl,
    depth,
    maxPages,
    headless: argv.headless,
    output,
    verbose: argv.verbose,
    delay: argv.delay,
    concurrency: Math.max(1, argv.concurrency),
    includePatterns: argv.include || [],
    excludePatterns: argv.exclude || [],
    full: argv.full,
    selector: argv.selector,
    elementType: tiposElegidos.join(',')
  };

  const crawler = new SimpleCrawler(options);
  const result = await crawler.run();

  const outputDir = require('path').dirname(options.output);
  if (!require('fs').existsSync(outputDir)) {
    require('fs').mkdirSync(outputDir, { recursive: true });
  }

  require('fs').writeFileSync(options.output, JSON.stringify(result, null, 2));

  console.log('\n' + '='.repeat(50));
  console.log('  ESCANEO FINALIZADO');
  console.log('='.repeat(50));
  console.log('URL base:      ' + result.baseUrl);
  console.log('Paginas:       ' + result.totalPages);
  const tipo = String(options.elementType);
  const tiposFinales = tipo.split(',').map((t: string) => t.trim().toLowerCase());
  const incluyeLinks = tiposFinales.includes('links') || tiposFinales.includes('all');
  console.log((incluyeLinks ? 'Enlaces total: ' : 'Elementos:     ') + result.totalLinks);
  if (incluyeLinks) {
    console.log('  Internos:    ' + result.links.filter((l: any) => l.isInternal).length);
    console.log('  Externos:    ' + result.links.filter((l: any) => !l.isInternal).length);
  }
  console.log('Errores:       ' + result.errors.length);
  console.log('Archivo:       ' + options.output);
  console.log('Concurrencia:  ' + options.concurrency);

  if (result.errors.length > 0 && options.verbose) {
    console.log('\nErrores:');
    result.errors.forEach((e: any) => console.log('  - ' + e));
  }

  const connRefused = result.errors.some((e: any) =>
    /ERR_CONNECTION_REFUSED|ECONNREFUSED/i.test(String(e))
  );
  if (connRefused) {
    console.log('\n  Pista: la conexion fue rechazada.');
    console.log('  Si es una URL local (localhost), el servidor no esta activo.');
    console.log('  Inicia el servidor con la opcion [7] (Pagina de ejemplo) o [6] (Panel Web)');
    console.log('  y asegurate de dejar esa ventana abierta.\n');
  }

  console.log('\n  Listo. El escaneo termino y el archivo JSON ya fue guardado.\n');
}

main().catch((err: any) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
