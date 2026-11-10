#!/usr/bin/env node
/**
 * CACHAI-QA - Reporte de defectos únicos
 *
 * Lee los resultados de Playwright (reports/results.json) y de Cucumber
 * (reports/cucumber/cucumber-report.json), agrupa los fallos que corresponden
 * al mismo defecto y escribe un resumen en Markdown:
 *
 *   reports/defectos-<host>-<fecha>.md
 *
 * Reglas:
 *  - Un timeout no es un defecto: se lista aparte como "sin verificar".
 *  - Un enlace 4xx/5xx es un defecto único por URL.
 *  - Un error de JavaScript se agrupa por su causa y se listan las páginas
 *    afectadas, para no repetir el mismo bug una vez por página y navegador.
 *  - El reporte se limita al scan/objetivo indicado. Si un artefacto de
 *    Playwright o Cucumber pertenece a otro sitio, ese motor se omite.
 *
 * Uso:
 *   node cli/report-defects.js [playwright|cucumber|both] [--scan=<archivo>]
 *   node cli/report-defects.js both --scan="scan-report/localhost-....json"
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const GENERATED = path.join(REPORTS, 'generated-tests');

const TIMEOUT_RE = /timeout|timed out|ETIMEDOUT|ECONNRESET|net::ERR_TIMED_OUT|NS_ERROR_NET_TIMEOUT/i;
const NETWORK_ERROR_RE = /ECONNREFUSED|ENOTFOUND|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_SSL|ERR_CERT|ERR_TOO_MANY_REDIRECTS|ERR_UNSAFE_REDIRECT|ERR_INVALID_URL|Protocol .* not supported|ERR_ABORTED/i;
const LINK_RE = /respondió HTTP 4\d\d|respondio HTTP 4\d\d|debe responder sin errores|menor a 400|toBeLessThan|Expected: < 400/i;

function readJson(file) {
  try {
    let text = fs.readFileSync(file, 'utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function slugDate(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

function normalizePath(value) {
  if (!value) return '';
  return path.relative(ROOT, path.resolve(ROOT, value)).replace(/\\/g, '/');
}

function originOf(raw) {
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return String(raw).replace(/\/+$/, '');
  }
}

function sameOrigin(a, b) {
  if (!a || !b) return true;
  return originOf(a) === originOf(b);
}

function hostSlug(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '') + (url.port ? '-' + url.port : '');
    return host.replace(/[^a-z0-9.-]+/gi, '-');
  } catch {
    return 'sitio';
  }
}

/** Lee la URL objetivo de un scan JSON del crawler o de un resumen del framework. */
function readScanTarget(scanPath) {
  if (!scanPath) return { file: '', target: '' };
  const full = path.isAbsolute(scanPath) ? scanPath : path.resolve(ROOT, scanPath);
  const data = readJson(full);
  const target = data && (data.baseUrl || (data.metadata && data.metadata.targetUrl));
  return {
    file: normalizePath(full),
    target: target ? String(target) : ''
  };
}

/** URL base del último resumen generado por from-scan.ts (respaldo). */
function latestTargetUrl() {
  if (!fs.existsSync(REPORTS)) return '';
  const files = fs.readdirSync(REPORTS)
    .filter((name) => /-\d{8}-\d{6}\.json$/i.test(name))
    .map((name) => ({ name, mtime: fs.statSync(path.join(REPORTS, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const file of files) {
    const data = readJson(path.join(REPORTS, file.name));
    const url = data && data.metadata && data.metadata.targetUrl;
    if (url) return String(url);
  }
  return '';
}

/**
 * El spec generado incluye en sus primeras líneas el scan de origen:
 *   // Escaneo: scan-report/localhost-20261105-143343.json
 * Eso permite saber a qué sitio pertenece el resultado de Playwright.
 */
function playwrightArtifactTarget() {
  const specPath = path.join(GENERATED, 'cachai-tests.spec.ts');
  if (!fs.existsSync(specPath)) return { target: '', scanPath: '' };

  const head = fs.readFileSync(specPath, 'utf8').split(/\r?\n/).slice(0, 12).join('\n');
  const match = head.match(/\/\/\s*Escaneo:\s*(.+)/i);
  if (!match) return { target: '', scanPath: '' };

  const scanPath = match[1].trim();
  const scan = readScanTarget(scanPath);
  return { target: scan.target, scanPath: scan.file || normalizePath(scanPath) };
}

function readCucumberFeatures() {
  const candidates = [
    path.join(REPORTS, 'cucumber', 'cucumber-report.json'),
    path.join(REPORTS, 'cucumber-report.json')
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) return null;
  const features = readJson(file);
  return Array.isArray(features) ? features : null;
}

/** La feature generada declara el sitio en su descripción: "Escaneo realizado sobre ...". */
function cucumberArtifactTarget(features) {
  for (const feature of features || []) {
    const text = `${feature.description || ''}\n${feature.name || ''}`;
    const match = text.match(/https?:\/\/[^\s"'<>]+/i);
    if (match) return { target: match[0].replace(/[.,;]+$/, ''), source: feature.name || feature.uri || '' };
  }
  return { target: '', source: '' };
}

function parseArgs(argv) {
  const args = { only: 'both', scan: '', target: '' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const lower = String(arg).toLowerCase();
    if (['playwright', 'cucumber', 'both'].includes(lower)) {
      args.only = lower;
      continue;
    }
    if (arg === '--scan') {
      args.scan = argv[++i] || '';
      continue;
    }
    if (arg.startsWith('--scan=')) {
      args.scan = arg.slice('--scan='.length);
      continue;
    }
    if (arg === '--target') {
      args.target = argv[++i] || '';
      continue;
    }
    if (arg.startsWith('--target=')) {
      args.target = arg.slice('--target='.length);
    }
  }
  return args;
}

function normalizeUrl(raw, base) {
  if (!raw) return '';
  try {
    const url = new URL(raw, base || undefined);
    url.hash = '';
    const pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '');
    return url.origin + pathname + url.search;
  } catch {
    return String(raw).replace(/#.*$/, '').replace(/\/+$/, '');
  }
}

function stripAnsi(value) {
  return String(value || '').replace(/\u001b\[[0-9;]*m/g, '');
}

function firstLine(message) {
  return stripAnsi(message).split('\n').map((line) => line.trim()).find(Boolean) || '';
}

/** Extrae la causa raíz de un mensaje de Playwright (que incluye diffs). */
function rootCause(message) {
  const text = stripAnsi(message).replace(/\\"/g, "'");
  const quoted = text.match(/"([^"]{0,160}(?:is not a function|is not defined|can't access property|Cannot (?:read|set) propert|hasOwnProperty)[^"]{0,160})"/i);
  if (quoted) return quoted[1].trim();
  if (/reCAPTCHA placeholder/i.test(text)) return 'reCAPTCHA placeholder element must be empty';
  return '';
}

function classify(message) {
  const text = stripAnsi(message);
  if (TIMEOUT_RE.test(text)) return { tipo: 'sin-verificar', firma: 'Tiempo de espera agotado' };
  if (NETWORK_ERROR_RE.test(text)) {
    let firma = 'Error de red';
    if (/ECONNREFUSED|ERR_CONNECTION_REFUSED/i.test(text)) firma = 'Conexión rechazada';
    else if (/ENOTFOUND|ERR_NAME_NOT_RESOLVED/i.test(text)) firma = 'Dominio no resuelto';
    else if (/ERR_SSL|ERR_CERT/i.test(text)) firma = 'Error de certificado SSL';
    else if (/ERR_TOO_MANY_REDIRECTS|ERR_UNSAFE_REDIRECT/i.test(text)) firma = 'Redirección inválida';
    else if (/ERR_INVALID_URL|Protocol .* not supported/i.test(text)) firma = 'URL inválida';
    else if (/ERR_ABORTED/i.test(text)) firma = 'Navegación abortada';
    return { tipo: 'defecto', firma };
  }
  if (LINK_RE.test(text)) return { tipo: 'defecto', firma: 'Enlace roto (HTTP 404)' };
  const cause = rootCause(text);
  if (cause) return { tipo: 'defecto', firma: 'Error JS: ' + cause };
  if (/debe responder 2xx/i.test(text)) return { tipo: 'defecto', firma: 'La página responde 404' };
  const first = firstLine(text)
    .replace(/\d+/g, 'N')
    .replace(/\s+/g, ' ')
    .slice(0, 160);
  return { tipo: 'defecto', firma: first || 'Fallo sin mensaje' };
}

function addDefect(store, defect) {
  // Los enlaces y los timeouts se agrupan por URL; los errores JS se agrupan
  // por causa y acumulan las páginas afectadas.
  const byUrl = defect.tipo === 'sin-verificar' || /^Enlace roto|^Conexión|^Dominio|^Error de|^Redirección|^URL inválida|^Navegación|^Tiempo de espera/.test(defect.firma);
  const key = byUrl ? `${defect.tipo}|${defect.url}|${defect.firma}` : `${defect.tipo}|${defect.firma}`;

  const existing = store.get(key);
  if (!existing) {
    store.set(key, {
      ...defect,
      urls: defect.url ? [defect.url] : [],
      navegadores: defect.navegadores.slice(),
      repeticiones: 1
    });
    return;
  }
  existing.repeticiones += 1;
  if (defect.url && existing.urls.indexOf(defect.url) === -1) existing.urls.push(defect.url);
  for (const navegador of defect.navegadores) {
    if (existing.navegadores.indexOf(navegador) === -1) existing.navegadores.push(navegador);
  }
}

/**
 * Playwright reporta un test de enlaces como un único fallo cuyo mensaje
 * contiene un array con varios enlaces rotos. Este parser extrae cada entrada
 * para no agrupar un 404 y una conexión rechazada como si fueran el mismo caso.
 */
function extractReceivedEntries(message) {
  const text = stripAnsi(message);
  const marker = text.indexOf('+ Array [');
  if (marker < 0) return [];

  const lines = text.slice(marker + '+ Array ['.length).split('\n');
  const entries = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.startsWith('+')) continue;
    const content = line.slice(1).trimStart();

    if (content === ']' || content === '],') break;

    if (content.startsWith('"')) {
      if (current !== null) entries.push(current);
      const singleLine = content.endsWith('",') || content === '"';
      current = content.slice(1);
      if (current.endsWith('",')) current = current.slice(0, -2);
      else if (current.endsWith('"')) current = current.slice(0, -1);
      if (singleLine) {
        entries.push(current);
        current = null;
      }
      continue;
    }

    if (/^"?,?$/.test(content)) {
      if (current !== null) {
        entries.push(current);
        current = null;
      }
      continue;
    }

    if (current !== null) current += '\n' + content;
  }

  if (current !== null) entries.push(current);
  return entries;
}

function addLinkEntries(store, message, targetUrl, browser) {
  const entries = extractReceivedEntries(message);
  let added = 0;

  for (const entry of entries) {
    const statusMatch = entry.match(/^(.+?) \(([^)]+)\) respondió HTTP (\d+)$/);
    if (statusMatch) {
      const status = Number(statusMatch[3]);
      addDefect(store, {
        tipo: 'defecto',
        motor: 'Playwright',
        url: normalizeUrl(statusMatch[2], targetUrl),
        firma: `Enlace roto (HTTP ${status})`,
        navegadores: browser ? [browser] : []
      });
      added += 1;
      continue;
    }

    const errorMatch = entry.match(/^(.+?) \(([^)]+)\) no se pudo conectar: ([\s\S]+)$/);
    if (errorMatch) {
      const classified = classify(errorMatch[3]);
      addDefect(store, {
        tipo: classified.tipo,
        motor: 'Playwright',
        url: normalizeUrl(errorMatch[2], targetUrl),
        firma: classified.firma,
        navegadores: browser ? [browser] : []
      });
      added += 1;
    }
  }

  return added;
}

function collectPlaywright(store, targetUrl) {
  const data = readJson(path.join(REPORTS, 'results.json'));
  if (!data) return 0;

  let failed = 0;
  const walk = (suite) => {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const result = (test.results || []).find((item) => item.status === 'failed');
        if (!result) continue;
        failed += 1;
        const error = result.error || (result.errors && result.errors[0]) || {};
        const message = String(error.message || error.value || '');
        const browser = test.projectName ? [String(test.projectName)] : [];

        // Un test de enlaces puede contener varios enlaces rotos en el mismo
        // mensaje; se procesan por separado antes de clasificar el mensaje global.
        if (addLinkEntries(store, message, targetUrl, browser[0]) > 0) continue;

        const pagePath = (String(spec.title || '').match(/«([^»]+)»/) || [])[1] || '';
        const fromMessage = (stripAnsi(message).match(/https?:\/\/[^\s)"']+/) || [])[0] || '';
        const { tipo, firma } = classify(message);
        addDefect(store, {
          tipo,
          motor: 'Playwright',
          url: normalizeUrl(fromMessage || pagePath, targetUrl),
          firma,
          navegadores: browser
        });
      }
    }
    for (const child of suite.suites || []) walk(child);
  };

  for (const suite of data.suites || []) walk(suite);
  return failed;
}

function urlFromSteps(steps) {
  for (const step of steps || []) {
    const name = String(step.name || '');
    const match = name.match(/https?:\/\/[^\s"']+/);
    if (match) return match[0];
  }
  return '';
}

function collectCucumber(store, targetUrl, features) {
  if (!Array.isArray(features)) return 0;

  let failed = 0;
  for (const feature of features) {
    for (const element of feature.elements || []) {
      if (element.type && element.type !== 'scenario') continue;
      const failedStep = (element.steps || []).find((step) => step.result && step.result.status === 'failed');
      if (!failedStep) continue;
      failed += 1;
      const message = String(failedStep.result.error_message || '');
      const { tipo, firma } = classify(message);
      addDefect(store, {
        tipo,
        motor: 'Cucumber',
        url: normalizeUrl(urlFromSteps(element.steps), targetUrl),
        firma,
        navegadores: ['chromium']
      });
    }
  }
  return failed;
}

/** Incluye en el reporte los enlaces con protocolo inválido detectados al escanear. */
function collectScanInvalidLinks(store, scanFile) {
  if (!scanFile) return 0;
  const full = path.isAbsolute(scanFile) ? scanFile : path.resolve(ROOT, scanFile);
  const data = readJson(full);
  if (!data || !Array.isArray(data.invalidLinks)) return 0;

  let count = 0;
  for (const link of data.invalidLinks) {
    const url = String(link.url || '');
    if (!url) continue;
    addDefect(store, {
      tipo: 'defecto',
      motor: 'Escaneo',
      url,
      firma: 'URL inválida',
      navegadores: []
    });
    count += 1;
  }
  return count;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const selected = readScanTarget(args.scan);
  const explicitTarget = args.target || selected.target;

  const playwrightTarget = playwrightArtifactTarget();
  const features = readCucumberFeatures();
  const cucumberTarget = cucumberArtifactTarget(features);

  let includePlaywright = args.only !== 'cucumber';
  let includeCucumber = args.only !== 'playwright';
  const warnings = [];

  let targetUrl = explicitTarget;

  // Sin scan explícito: solo se comparan los motores que se van a incluir.
  // Si los dos artefactos apuntan a sitios distintos, no se puede generar
  // un reporte confiable.
  if (!targetUrl && includePlaywright && includeCucumber
    && playwrightTarget.target && cucumberTarget.target
    && !sameOrigin(playwrightTarget.target, cucumberTarget.target)) {
    console.error('[DEFECTOS] Los artefactos pertenecen a sitios distintos:');
    console.error('  Playwright: ' + playwrightTarget.target);
    console.error('  Cucumber:   ' + cucumberTarget.target);
    console.error('  Indica el scan correcto con --scan="scan-report/archivo.json".');
    process.exitCode = 2;
    return;
  }

  if (!targetUrl) {
    if (includePlaywright && playwrightTarget.target) targetUrl = playwrightTarget.target;
    else if (includeCucumber && cucumberTarget.target) targetUrl = cucumberTarget.target;
    else targetUrl = latestTargetUrl();
  }

  // Validar que el artefacto de cada motor corresponda al scan/objetivo.
  if (includePlaywright) {
    const scanMismatch = selected.file && playwrightTarget.scanPath
      && normalizePath(playwrightTarget.scanPath) !== normalizePath(selected.file);
    if (scanMismatch || !sameOrigin(targetUrl, playwrightTarget.target)) {
      includePlaywright = false;
      warnings.push(
        `Playwright omitido: el spec generado pertenece a ${playwrightTarget.target || playwrightTarget.scanPath || 'otro objetivo'}`
      );
    }
  }

  if (includeCucumber && !sameOrigin(targetUrl, cucumberTarget.target)) {
    includeCucumber = false;
    warnings.push(
      `Cucumber omitido: el reporte pertenece a ${cucumberTarget.target || 'otro objetivo'}`
    );
  }

  if (!includePlaywright && !includeCucumber) {
    console.error('[DEFECTOS] No se generó el reporte: ningún motor corresponde al objetivo indicado.');
    warnings.forEach((warning) => console.error('  - ' + warning));
    process.exitCode = 3;
    return;
  }

  const store = new Map();
  const pwFailed = includePlaywright ? collectPlaywright(store, targetUrl) : 0;
  const cbFailed = includeCucumber ? collectCucumber(store, targetUrl, features) : 0;
  const scanInvalid = selected.file ? collectScanInvalidLinks(store, selected.file) : 0;

  const all = Array.from(store.values());
  const defects = all.filter((item) => item.tipo === 'defecto').sort((a, b) => b.repeticiones - a.repeticiones);
  const unverified = all.filter((item) => item.tipo === 'sin-verificar');

  const host = targetUrl ? hostSlug(targetUrl) : 'sitio';

  const lines = [];
  lines.push(`# Defectos detectados en ${targetUrl || host}`);
  lines.push('');
  lines.push(`Generado: ${new Date().toLocaleString('es-CL')}`);
  if (selected.file) lines.push(`Scan: \`${selected.file}\``);
  const engines = [];
  if (includePlaywright) engines.push('Playwright');
  if (includeCucumber) engines.push('Cucumber');
  lines.push(`Motores incluidos: ${engines.join(', ')}`);
  if (warnings.length > 0) lines.push(`Motores omitidos: ${warnings.join(' | ')}`);
  lines.push('');
  lines.push(`- Fallos brutos (tests): **${pwFailed + cbFailed}** (Playwright ${pwFailed}, Cucumber ${cbFailed})`);
  lines.push(`- Defectos únicos: **${defects.length}**`);
  lines.push(`- Comprobaciones sin verificar (timeouts): **${unverified.length}**`);
  if (scanInvalid > 0) lines.push(`- Enlaces inválidos detectados en el escaneo: **${scanInvalid}**`);
  lines.push('');

  lines.push('## Defectos');
  lines.push('');
  if (defects.length === 0) {
    lines.push('No se detectaron defectos confirmados.');
  } else {
    lines.push('| # | Defecto | URLs afectadas | Navegadores | Veces | Motor |');
    lines.push('|---|---|---|---|---|---|');
    defects.forEach((item, index) => {
      const urls = item.urls.slice(0, 6).map((url) => url || '—').join('<br>');
      const extra = item.urls.length > 6 ? `<br>(+${item.urls.length - 6} más)` : '';
      lines.push(`| ${index + 1} | ${item.firma} | ${urls || '—'}${extra} | ${item.navegadores.join(', ') || '—'} | ${item.repeticiones} | ${item.motor} |`);
    });
  }
  lines.push('');

  if (unverified.length > 0) {
    lines.push('## Sin verificar (timeouts, no cuentan como defecto)');
    lines.push('');
    lines.push('| URL | Navegadores | Veces | Motor |');
    lines.push('|---|---|---|---|');
    unverified.forEach((item) => {
      lines.push(`| ${item.urls.join('<br>') || '—'} | ${item.navegadores.join(', ') || '—'} | ${item.repeticiones} | ${item.motor} |`);
    });
    lines.push('');
  }

  if (!fs.existsSync(REPORTS)) fs.mkdirSync(REPORTS, { recursive: true });
  const baseFile = path.join(REPORTS, `defectos-${host}-${slugDate()}`);
  let outFile = baseFile + '.md';
  let suffix = 1;
  while (fs.existsSync(outFile)) {
    suffix += 1;
    outFile = `${baseFile}-${suffix}.md`;
  }
  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');

  console.log('');
  console.log('=== DEFECTOS ÚNICOS ===');
  console.log(`Objetivo:           ${targetUrl || '(no determinado)'}`);
  if (selected.file) console.log(`Scan:               ${selected.file}`);
  if (warnings.length > 0) warnings.forEach((warning) => console.log(`AVISO:              ${warning}`));
  console.log(`Fallos brutos (tests): ${pwFailed + cbFailed}`);
  console.log(`Defectos únicos:    ${defects.length}`);
  console.log(`Sin verificar:      ${unverified.length}`);
  if (scanInvalid > 0) console.log(`Enlaces inválidos:  ${scanInvalid}`);
  console.log(`Reporte:            ${path.relative(ROOT, outFile).replace(/\\/g, '/')}`);
}

main();
