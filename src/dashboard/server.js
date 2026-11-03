#!/usr/bin/env node
'use strict';

/**
 * CACHAI-QA - Panel web local
 * Servidor HTTP sin dependencias externas que sirve el dashboard y expone
 * APIs para listar / ver / eliminar escaneos y ver / ejecutar los tests.
 *
 * Uso: node dashboard/server.js  (o npm run dashboard)
 * Variable opcional: DASHBOARD_PORT (por defecto 4321)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn, exec } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DASHBOARD_DIR = __dirname;
const BASE_PORT = parseInt(process.env.DASHBOARD_PORT, 10) || 4321;
const SCAN_DIRS = [ROOT, path.join(ROOT, 'reports'), path.join(ROOT, 'scan-report')];
const EXCLUDED = new Set(['package.json', 'package-lock.json', 'tsconfig.json', 'results.json']);
const MAX_PARSE_BYTES = 25 * 1024 * 1024;

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function safeStat(full) {
  try { return fs.statSync(full); } catch { return null; }
}

/**
 * Lee y parsea un JSON ignorando un posible BOM inicial.
 * Los reportes grandes (results.json, escaneos de sitios completos) se cachean
 * por ruta + mtime + tamaño para que el dashboard no los reprocese en cada request.
 */
const jsonCache = new Map();

function readJsonFile(full) {
  const st = safeStat(full);
  const key = st ? `${full}|${st.mtimeMs}|${st.size}` : full;
  if (jsonCache.has(key)) return jsonCache.get(key);

  let text = fs.readFileSync(full, 'utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const data = JSON.parse(text);

  if (jsonCache.size > 40) jsonCache.clear();
  jsonCache.set(key, data);
  return data;
}

/**
 * Clasifica un escaneo según el alcance configurado en el crawler.
 * quick: enlaces, profundidad 1 y hasta 50 páginas.
 * full: todos los elementos, profundidad alta o sin límite de páginas.
 * custom: cualquier combinación elegida manualmente.
 */
function detectScanType(meta) {
  const config = meta && typeof meta === 'object' ? meta : {};
  const types = String(config.elementType || '').toLowerCase();
  const depth = Number(config.depth);
  const maxPages = Number(config.maxPages);

  if (types === 'links' && (!Number.isFinite(depth) || depth <= 1) && (!Number.isFinite(maxPages) || maxPages <= 50)) {
    return 'quick';
  }
  if (types === 'all' && ((Number.isFinite(depth) && depth >= 10) || (Number.isFinite(maxPages) && maxPages >= 99999))) {
    return 'full';
  }
  return 'custom';
}

/** Devuelve un objeto con metadatos si el JSON parece un escaneo, o null. */
function readScanMeta(full) {
  const st = safeStat(full);
  if (!st || !st.isFile()) return null;
  if (st.size > MAX_PARSE_BYTES) return { kind: 'unknown' };

  let obj;
  try {
    obj = readJsonFile(full);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;

  // Formato del crawler (opción 1)
  if (typeof obj.baseUrl === 'string' || Array.isArray(obj.links)) {
    return {
      kind: 'crawl',
      scanType: detectScanType(obj.scanMeta),
      url: obj.baseUrl || '',
      pages: obj.totalPages,
      links: typeof obj.totalLinks === 'number' ? obj.totalLinks : (Array.isArray(obj.links) ? obj.links.length : undefined),
      errors: Array.isArray(obj.errors) ? obj.errors.length : 0,
      timestamp: obj.timestamp
    };
  }

  // Formato del framework (opcion 4)
  if (obj.metadata && typeof obj.metadata === 'object') {
    return {
      kind: 'framework',
      scanType: detectScanType(obj.metadata.config),
      url: obj.metadata.targetUrl || '',
      pages: obj.metadata.pagesScanned,
      tests: obj.metadata.testsGenerated,
      mode: obj.metadata.mode,
      timestamp: obj.metadata.timestamp
    };
  }
  return null;
}

let scansCache = { at: 0, data: [] };

function listScanFiles(force) {
  if (!force && Date.now() - scansCache.at < 1500) return scansCache.data;

  const found = [];
  for (const dir of SCAN_DIRS) {
    if (!fs.existsSync(dir)) continue;
    let entries;
    try { entries = fs.readdirSync(dir); } catch { continue; }
    for (const name of entries) {
      if (!name.toLowerCase().endsWith('.json')) continue;
      if (EXCLUDED.has(name)) continue;
      const full = path.join(dir, name);
      const meta = readScanMeta(full);
      if (!meta) continue;
      const st = safeStat(full);
      found.push({
        file: path.relative(ROOT, full).replace(/\\/g, '/'),
        name,
        dir: path.relative(ROOT, dir).replace(/\\/g, '/') || '.',
        size: st ? st.size : 0,
        mtime: st ? st.mtimeMs : 0,
        ...meta
      });
    }
  }
  const sorted = found.sort((a, b) => b.mtime - a.mtime);
  scansCache = { at: Date.now(), data: sorted };
  return sorted;
}

/** Resuelve y valida que un archivo esté directamente dentro de una carpeta permitida. */
function resolveScanPath(file) {
  if (!file || typeof file !== 'string') return null;
  const full = path.resolve(ROOT, file);
  if (!full.toLowerCase().endsWith('.json')) return null;
  const dir = path.dirname(full);
  const allowed = SCAN_DIRS.some((d) => path.resolve(d) === dir);
  return allowed ? full : null;
}

/** Último JSON de Cucumber con contenido (ignora archivos truncados o vacíos). */
function latestCucumberJson() {
  const dir = path.join(ROOT, 'reports', 'cucumber');
  if (!fs.existsSync(dir)) return null;
  let best = null;
  for (const name of fs.readdirSync(dir)) {
    if (!/^cucumber-report-\d{8}-\d{6}\.json$/i.test(name)) continue;
    const full = path.join(dir, name);
    const st = safeStat(full);
    if (!st || st.size <= 2) continue;
    if (!best || st.mtimeMs > best.mtime) best = { full, mtime: st.mtimeMs };
  }
  return best ? best.full : null;
}

/** Convierte un reporte JSON de Cucumber en métricas y escenarios legibles. */
function parseCucumberReport(file) {
  const candidates = file
    ? [file]
    : [
        path.join(ROOT, 'reports', 'cucumber', 'cucumber-report.json'),
        latestCucumberJson(),
        path.join(ROOT, 'reports', 'cucumber-report.json')
      ].filter(Boolean);
  const target = candidates.find((candidate) => {
    const st = safeStat(candidate);
    return Boolean(st && st.size > 2);
  });
  if (!target) return null;

  let features;
  try {
    features = readJsonFile(target);
  } catch {
    return null;
  }
  if (!Array.isArray(features)) return null;

  const totals = {
    totalFeatures: features.length,
    totalScenarios: 0,
    totalSteps: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    undefined: 0,
    scenariosPassed: 0,
    scenariosFailed: 0,
    scenariosSkipped: 0
  };

  const parsedFeatures = features.map((feature) => {
    const scenarios = [];
    for (const element of feature.elements || []) {
      if (element.type !== 'scenario') continue;
      totals.totalScenarios += 1;

      const allSteps = element.steps || [];
      const hookFailed = allSteps.some((step) => step.hidden && step.result && step.result.status === 'failed');
      const steps = allSteps
        .filter((step) => !step.hidden)
        .map((step) => {
          const status = (step.result && step.result.status) || 'undefined';
          totals.totalSteps += 1;
          if (status === 'passed') totals.passed += 1;
          else if (status === 'failed') totals.failed += 1;
          else if (status === 'skipped' || status === 'pending') totals.skipped += 1;
          else totals.undefined += 1;
          return {
            keyword: String(step.keyword || '').trim(),
            name: String(step.name || ''),
            status,
            error: String((step.result && step.result.error_message) || '')
          };
        });

      let status = 'passed';
      if (hookFailed || steps.some((step) => step.status === 'failed')) status = 'failed';
      else if (steps.some((step) => step.status === 'undefined')) status = 'undefined';
      else if (steps.length > 0 && steps.every((step) => step.status === 'skipped')) status = 'skipped';

      if (status === 'passed') totals.scenariosPassed += 1;
      else if (status === 'failed') totals.scenariosFailed += 1;
      else totals.scenariosSkipped += 1;

      const scenarioUrl = steps.map((step) => extractUrl(step.name)).find(Boolean) || '';
      scenarios.push({ name: String(element.name || ''), status, steps, url: scenarioUrl });
    }
    return { name: String(feature.name || ''), uri: String(feature.uri || ''), scenarios };
  });

  const st = safeStat(target);
  return {
    reportPath: path.relative(ROOT, target).replace(/\\/g, '/'),
    generatedAt: st ? st.mtimeMs : null,
    totals,
    features: parsedFeatures
  };
}

function formatSlug(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// ------------------------------------------------------------------
// Resumen general (Home)
// ------------------------------------------------------------------

function extractUrl(value) {
  const match = String(value || '').match(/https?:\/\/[^\s"'<>)\]]+/i);
  return match ? match[0].replace(/[.,;]+$/, '') : '';
}

function joinUrl(base, value) {
  if (!base) return value;
  try { return new URL(value, base).toString(); } catch { return value; }
}

function shortPath(value) {
  try {
    const parsed = new URL(value);
    return `${parsed.pathname}${parsed.search}` || '/';
  } catch {
    return value || '—';
  }
}

function diagnose(message) {
  const text = String(message || '');
  const received = /Received:\s*(\d{3})/i.exec(text);
  const statusCode = received ? received[1] : '';

  if (statusCode) {
    if (statusCode === '404') {
      return {
        code: statusCode,
        title: 'Recurso no encontrado (404)',
        diagnosis: 'El servidor indicó que el recurso solicitado no existe en la ruta indicada.',
        recommendation: 'Corrige la URL o vuelve a publicar el archivo; revisa enlaces y rutas de imágenes en la plantilla de origen.'
      };
    }
    if (statusCode.startsWith('5')) {
      return {
        code: statusCode,
        title: `Error del servidor (${statusCode})`,
        diagnosis: 'El servidor falló al procesar la petición.',
        recommendation: 'Revisa los logs del servidor, permisos y disponibilidad del backend.'
      };
    }
    return {
      code: statusCode,
      title: `Respuesta HTTP ${statusCode}`,
      diagnosis: 'El recurso respondió con un código HTTP no esperado.',
      recommendation: 'Revisa la ruta, la autenticación y la configuración del servidor.'
    };
  }

  if (/imagen|imágenes|imagenes|naturalwidth|img/i.test(text) && /rota|broken/i.test(text)) {
    return {
      code: 'IMG',
      title: 'Imagen rota',
      diagnosis: 'La imagen no se cargó o tiene dimensiones naturales iguales a cero.',
      recommendation: 'Verifica la ruta del archivo, el atributo src y que la imagen exista en el servidor.'
    };
  }

  if (/javascript|pageerror|errores de javascript/i.test(text)) {
    return {
      code: 'JS',
      title: 'Error de JavaScript',
      diagnosis: 'La página lanzó una excepción durante la carga o la interacción.',
      recommendation: 'Revisa la consola del navegador y corrige el script que genera el error.'
    };
  }

  if (/formulario|form/i.test(text)) {
    return {
      code: 'FORM',
      title: 'Error en formulario',
      diagnosis: 'El formulario no está presente, visible o habilitado como se esperaba.',
      recommendation: 'Revisa la estructura del formulario y sus validaciones en el DOM.'
    };
  }

  if (/botón|boton|button/i.test(text)) {
    return {
      code: 'BTN',
      title: 'Error en botón',
      diagnosis: 'El botón no está visible o no está habilitado.',
      recommendation: 'Revisa el estado, los estilos y los eventos del botón.'
    };
  }

  if (/locator|tobevisible|toenabled|received:\s*hidden|waiting for locator/i.test(text)) {
    return {
      code: 'VIS',
      title: 'Elemento no visible o no interactuable',
      diagnosis: 'El elemento existe en el DOM pero no está visible o habilitado en el momento de la prueba.',
      recommendation: 'Revisa los estilos, el estado del componente y si depende de una interacción previa para mostrarse.'
    };
  }

  if (/net::|ERR_|ECONN|ENOTFOUND|ETIMEDOUT|timed out|timeout/i.test(text)) {
    return {
      code: 'NET',
      title: 'Error de red o tiempo de espera',
      diagnosis: 'El navegador no pudo completar la petición al recurso.',
      recommendation: 'Verifica la disponibilidad del servidor, la URL y los tiempos de espera configurados.'
    };
  }

  return {
    code: 'ASSERT',
    title: 'Fallo de validación',
    diagnosis: 'La prueba no cumplió la condición esperada.',
    recommendation: 'Revisa el detalle técnico y el reporte interactivo para ubicar el elemento afectado.'
  };
}

function publicAttachment(absPath) {
  if (!absPath) return null;
  const rel = path.relative(ROOT, absPath).replace(/\\/g, '/');
  if (rel.startsWith('test-results/') || rel.startsWith('reports/')) return '/' + rel;
  return null;
}

/** Último reporte HTML de Playwright (carpeta reports/playwright-report-*). */
function latestPlaywrightReport() {
  const reportsDir = path.join(ROOT, 'reports');
  if (!fs.existsSync(reportsDir)) return null;
  let best = null;
  for (const name of fs.readdirSync(reportsDir)) {
    if (!name.startsWith('playwright-report-')) continue;
    const idx = path.join(reportsDir, name, 'index.html');
    const st = safeStat(idx);
    if (!st) continue;
    if (!best || st.mtimeMs > best.mtime) {
      best = { name, path: 'reports/' + name + '/index.html', mtime: st.mtimeMs };
    }
  }
  return best;
}

/** Último reporte HTML de Cucumber (reports/cucumber/*.html). */
function latestCucumberReport() {
  const dir = path.join(ROOT, 'reports', 'cucumber');
  if (!fs.existsSync(dir)) return null;
  let best = null;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.html')) continue;
    if (name !== 'cucumber-report.html' && !/^cucumber-report-\d{8}-\d{6}\.html$/i.test(name)) continue;
    const st = safeStat(path.join(dir, name));
    if (!st) continue;
    if (!best || st.mtimeMs > best.mtime) {
      best = { name, path: 'reports/cucumber/' + name, mtime: st.mtimeMs };
    }
  }
  return best;
}

/** Resumen de framework (metadata/pages/testSuite) más cercano a una ejecución. */
function frameworkSummaryNear(ms) {
  const summaries = listScanFiles().filter((scan) => scan.kind === 'framework');
  let best = null;
  let bestDiff = Infinity;
  for (const summary of summaries) {
    const diff = Math.abs(summary.mtime - ms);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = summary;
    }
  }
  return best && bestDiff <= 30 * 60 * 1000 ? best : null;
}

function collectFailedSpecs(suite, out, limit) {
  if (!suite || out.length >= limit) return;
  for (const spec of suite.specs || []) {
    if (!spec.ok) out.push(spec);
    if (out.length >= limit) return;
  }
  for (const child of suite.suites || []) {
    collectFailedSpecs(child, out, limit);
    if (out.length >= limit) return;
  }
}

/** Lee una entrada concreta de un ZIP en memoria (sin dependencias externas). */
function readZipEntry(buffer, entryName) {
  let eocd = -1;
  const min = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= min; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;

  const total = buffer.readUInt16LE(eocd + 10);
  let ptr = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < total; index++) {
    if (ptr + 46 > buffer.length || buffer.readUInt32LE(ptr) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(ptr + 10);
    const compressedSize = buffer.readUInt32LE(ptr + 20);
    const nameLength = buffer.readUInt16LE(ptr + 28);
    const extraLength = buffer.readUInt16LE(ptr + 30);
    const commentLength = buffer.readUInt16LE(ptr + 32);
    const localOffset = buffer.readUInt32LE(ptr + 42);
    const name = buffer.toString('utf8', ptr + 46, ptr + 46 + nameLength);

    if (name === entryName && localOffset + 30 <= buffer.length) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return Buffer.from(compressed);
      if (method === 8) return zlib.inflateRawSync(compressed);
      return null;
    }
    ptr += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

/** Extrae un objeto JSON concreto sin parsear todo el archivo. */
function extractJsonObjectAfterKey(text, key) {
  const index = text.lastIndexOf(key);
  if (index < 0) return null;
  const start = text.indexOf('{', index);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

const playwrightStatsCache = new Map();

/** Obtiene las métricas de un reporte HTML de Playwright ya generado. */
function readPlaywrightReportStats(reportDir) {
  const indexPath = path.join(reportDir, 'index.html');
  const st = safeStat(indexPath);
  if (!st) return null;

  const cacheKey = indexPath + '|' + st.mtimeMs + '|' + st.size;
  if (playwrightStatsCache.has(cacheKey)) return playwrightStatsCache.get(cacheKey);

  let result = null;
  try {
    const html = fs.readFileSync(indexPath, 'utf8');
    const match = html.match(/id="playwrightReportBase64"[^>]*>\s*data:application\/zip;base64,([^<]+)/i);
    if (match) {
      const zip = Buffer.from(match[1].trim(), 'base64');
      const report = readZipEntry(zip, 'report.json');
      if (report) {
        const stats = extractJsonObjectAfterKey(report.toString('utf8'), '"stats"');
        if (stats) {
          const expected = Number(stats.expected) || 0;
          const unexpected = Number(stats.unexpected) || 0;
          const flaky = Number(stats.flaky) || 0;
          const skipped = Number(stats.skipped) || 0;
          result = {
            total: expected + unexpected + flaky + skipped,
            passed: expected,
            failed: unexpected,
            flaky,
            skipped
          };
        }
      }
    }
  } catch {
    result = null;
  }

  if (playwrightStatsCache.size > 120) playwrightStatsCache.clear();
  playwrightStatsCache.set(cacheKey, result);
  return result;
}

function readPlaywrightOverview() {
  const file = path.join(ROOT, 'reports', 'results.json');
  if (!fs.existsSync(file)) return null;

  let data;
  try { data = readJsonFile(file); } catch { return null; }

  const st = safeStat(file);
  const stats = data.stats || {};
  const expected = Number(stats.expected) || 0;
  const unexpected = Number(stats.unexpected) || 0;
  const flaky = Number(stats.flaky) || 0;
  const skipped = Number(stats.skipped) || 0;
  const total = expected + unexpected + flaky + skipped;

  const summary = frameworkSummaryNear(st.mtimeMs);
  const targetUrl = summary ? summary.url : '';

  const failedSpecs = [];
  collectFailedSpecs(data, failedSpecs, 120);
  const errorsList = [];

  for (const spec of failedSpecs) {
    for (const test of spec.tests || []) {
      const result = (test.results || []).find((item) => item.status === 'failed');
      if (!result) continue;

      const error = result.error || (result.errors && result.errors[0]) || {};
      const message = String(error.message || error.value || '');
      const pagePath = (String(spec.title || '').match(/«([^»]+)»/) || [])[1] || '';
      const origin = pagePath ? joinUrl(targetUrl, pagePath) : targetUrl;
      const affected = extractUrl(message) || origin;
      const diagnosis = diagnose(message);
      const specFile = spec.file ? path.basename(spec.file) : '';
      const specLine = spec.line || (spec.tests && spec.tests[0] && spec.tests[0].line) || '';
      const selectorMatch = message.match(/Locator:\s*([^\n]+)/i) || message.match(/locator\(([^)]*)\)/i);
      const selector = selectorMatch ? selectorMatch[1].trim() : '';
      const attachments = (result.attachments || [])
        .map((attachment) => {
          const publicPath = publicAttachment(attachment.path);
          return publicPath ? {
            name: attachment.name || 'adjunto',
            type: attachment.contentType || '',
            path: publicPath
          } : null;
        })
        .filter(Boolean);

      errorsList.push({
        id: 'pw-' + errorsList.length,
        engine: 'playwright',
        code: diagnosis.code,
        title: diagnosis.title,
        summary: String(spec.title || ''),
        file: specFile,
        line: specLine,
        selector,
        url: affected,
        origin,
        diagnosis: diagnosis.diagnosis,
        recommendation: diagnosis.recommendation,
        technicalLog: message + (error.stack ? '\n\n' + error.stack : ''),
        attachments
      });

      if (errorsList.length >= 120) break;
    }
    if (errorsList.length >= 120) break;
  }

  const report = latestPlaywrightReport();

  return {
    available: true,
    type: 'playwright',
    timestamp: st.mtimeMs,
    startedAt: stats.startTime ? Date.parse(stats.startTime) : st.mtimeMs,
    url: targetUrl,
    pages: summary ? summary.pages : null,
    elements: total,
    total,
    successes: expected,
    warnings: skipped + flaky,
    errors: unexpected,
    executed: expected + unexpected + flaky,
    skipped,
    duration: Number(stats.duration) || 0,
    health: total ? (expected / total) * 100 : 0,
    reportPath: report ? report.path : null,
    errorsList,
    stats: { expected, unexpected, flaky, skipped, duration: Number(stats.duration) || 0 }
  };
}

function cucumberErrorCards(cucumber, targetUrl) {
  const cards = [];
  for (const feature of cucumber.features || []) {
    for (const scenario of feature.scenarios || []) {
      if (scenario.status !== 'failed') continue;
      const failedStep = (scenario.steps || []).find((step) => step.status === 'failed') || {};
      const message = failedStep.error || '';
      const diagnosis = diagnose(message);
      const origin = scenario.url || targetUrl;
      const affected = extractUrl(message) || origin;

      cards.push({
        id: 'cb-' + cards.length,
        engine: 'cucumber',
        code: diagnosis.code,
        title: diagnosis.title,
        summary: scenario.name,
        feature: feature.name,
        step: failedStep.name || '',
        stepKeyword: failedStep.keyword || '',
        url: affected,
        origin,
        diagnosis: diagnosis.diagnosis,
        recommendation: diagnosis.recommendation,
        technicalLog: message,
        attachments: []
      });
    }
  }
  return cards;
}

function readCucumberOverview() {
  const cucumber = parseCucumberReport();
  if (!cucumber) return null;

  const summary = frameworkSummaryNear(cucumber.generatedAt);
  const firstScenarioUrl = (cucumber.features || [])
    .flatMap((feature) => feature.scenarios || [])
    .map((scenario) => scenario.url)
    .find(Boolean);
  const targetUrl = summary ? summary.url : (firstScenarioUrl || '');
  const errorsList = cucumberErrorCards(cucumber, targetUrl);
  const total = cucumber.totals.totalScenarios;
  const successes = cucumber.totals.scenariosPassed;
  const warnings = cucumber.totals.scenariosSkipped;
  const errors = cucumber.totals.scenariosFailed;
  const htmlReport = cucumber.reportPath.replace(/\.json$/i, '.html');
  const reportPath = fs.existsSync(path.join(ROOT, htmlReport)) ? htmlReport : cucumber.reportPath;

  return {
    available: true,
    type: 'cucumber',
    timestamp: cucumber.generatedAt || Date.now(),
    startedAt: cucumber.generatedAt,
    url: targetUrl,
    pages: summary ? summary.pages : null,
    elements: cucumber.totals.totalSteps,
    total,
    successes,
    warnings,
    errors,
    executed: successes + errors,
    skipped: warnings,
    duration: null,
    health: total ? (successes / total) * 100 : 0,
    reportPath,
    errorsList,
    totals: cucumber.totals
  };
}

function readScanOverview() {
  const latest = listScanFiles().find((scan) => scan.kind === 'crawl');
  if (!latest) return null;

  const total = latest.links || latest.pages || 0;
  const errors = latest.errors || 0;
  return {
    available: true,
    type: 'scan',
    timestamp: latest.mtime,
    startedAt: latest.timestamp || new Date(latest.mtime).toISOString(),
    url: latest.url || '',
    pages: latest.pages,
    elements: total,
    total,
    successes: Math.max(0, total - errors),
    warnings: 0,
    errors,
    executed: total,
    skipped: 0,
    health: total ? ((total - errors) / total) * 100 : 0,
    reportPath: null,
    errorsList: []
  };
}

function buildOverview() {
  const playwright = readPlaywrightOverview();
  const cucumber = readCucumberOverview();
  const candidates = [playwright, cucumber].filter(Boolean).sort((a, b) => b.timestamp - a.timestamp);
  const latest = candidates[0] || readScanOverview();

  const brief = (execution) => execution ? {
    available: true,
    timestamp: execution.timestamp,
    url: execution.url,
    pages: execution.pages,
    total: execution.total,
    successes: execution.successes,
    warnings: execution.warnings,
    errors: execution.errors,
    executed: execution.executed,
    skipped: execution.skipped,
    duration: execution.duration || null,
    health: execution.health,
    reportPath: execution.reportPath,
    errorsList: execution.errorsList
  } : { available: false };

  if (!latest) {
    return {
      available: false,
      generatedAt: Date.now(),
      playwright: brief(playwright),
      cucumber: brief(cucumber)
    };
  }

  const total = Number(latest.total) || 0;
  const successes = Number(latest.successes) || 0;
  const warnings = Number(latest.warnings) || 0;
  const errors = Number(latest.errors) || 0;
  const health = total ? Math.round((successes / total) * 1000) / 10 : 0;
  const status = health >= 90 ? 'optimal' : health >= 70 ? 'regular' : 'critical';

  return {
    available: true,
    generatedAt: Date.now(),
    source: {
      type: latest.type,
      timestamp: latest.timestamp,
      startedAt: latest.startedAt,
      url: latest.url || '',
      reportPath: latest.reportPath || null
    },
    health: { percent: health, status },
    counts: {
      total,
      successes,
      warnings,
      errors,
      pages: latest.pages,
      elements: latest.elements,
      executed: latest.executed,
      skipped: latest.skipped
    },
    errorsList: latest.errorsList || [],
    playwright: brief(playwright),
    cucumber: brief(cucumber)
  };
}

function getTestsInfo() {
  const genDir = path.join(ROOT, 'reports', 'generated-tests');
  const specPath = path.join(genDir, 'cachai-tests.spec.ts');
  const configPath = path.join(genDir, 'playwright.config.ts');
  const cucumber = parseCucumberReport();

  const spec = {
    exists: false,
    path: 'reports/generated-tests/cachai-tests.spec.ts',
    tests: [],
    mtime: null,
    hasConfig: fs.existsSync(configPath)
  };
  if (fs.existsSync(specPath)) {
    spec.exists = true;
    const content = fs.readFileSync(specPath, 'utf8');
    const names = [];
    const re = /test(?:\.skip|\.only|\.fixme)?\(\s*['"`]([^'"`]+)['"`]/g;
    let m;
    while ((m = re.exec(content))) names.push(m[1]);
    spec.tests = names;
    const st = safeStat(specPath);
    spec.mtime = st ? st.mtimeMs : null;
  }

  const reportsDir = path.join(ROOT, 'reports');
  const cucumberDir = path.join(reportsDir, 'cucumber');
  const reports = [];

  if (fs.existsSync(reportsDir)) {
    for (const name of fs.readdirSync(reportsDir)) {
      if (name.startsWith('playwright-report-')) {
        const idx = path.join(reportsDir, name, 'index.html');
        if (fs.existsSync(idx)) {
          const st = safeStat(idx);
          reports.push({ name, type: 'playwright', path: 'reports/' + name + '/index.html', mtime: st ? st.mtimeMs : 0 });
        }
      }
    }
  }

  const addCucumberReport = (full, name) => {
    if (!fs.existsSync(full)) return;
    const st = safeStat(full);
    reports.push({
      name,
      type: 'cucumber',
      path: path.relative(ROOT, full).replace(/\\/g, '/'),
      mtime: st ? st.mtimeMs : 0
    });
  };

  // Reporte BDD actual y copias fechadas que deja cli/report-cucumber.js.
  // Si el JSON actual quedó truncado (por ejemplo, una ejecución interrumpida),
  // se omite el HTML actual y se usan las copias fechadas válidas.
  const nestedCucumber = path.join(cucumberDir, 'cucumber-report.html');
  const currentCucumberJson = path.join(cucumberDir, 'cucumber-report.json');
  const currentJsonStat = safeStat(currentCucumberJson);
  const currentCucumberValid = Boolean(currentJsonStat && currentJsonStat.size > 2);
  if (currentCucumberValid && fs.existsSync(nestedCucumber)) {
    addCucumberReport(nestedCucumber, 'cucumber-report.html');
  } else {
    addCucumberReport(path.join(reportsDir, 'cucumber-report.html'), 'cucumber-report.html');
  }
  if (fs.existsSync(cucumberDir)) {
    for (const name of fs.readdirSync(cucumberDir)) {
      if (/^cucumber-report-\d{8}-\d{6}\.html$/i.test(name)) {
        addCucumberReport(path.join(cucumberDir, name), name);
      }
    }
  }

  const seen = new Set();
  const uniqueReports = reports
    .filter((report) => {
      if (seen.has(report.path)) return false;
      seen.add(report.path);
      return true;
    })
    .sort((a, b) => b.mtime - a.mtime);

  // Cargar métricas BDD si existen; si no, se derivan del JSON de Cucumber.
  let bddMetrics = null;
  const metricsPath = path.join(reportsDir, 'bdd-metrics.json');
  if (fs.existsSync(metricsPath)) {
    try {
      bddMetrics = readJsonFile(metricsPath);
    } catch { /* ignorar */ }
  }
  if (!bddMetrics && cucumber) {
    bddMetrics = { ...cucumber.totals, generatedAt: cucumber.generatedAt, report: cucumber.reportPath };
  }

  return { spec, reports: uniqueReports, bddMetrics, cucumber };
}

/** Convierte el slug de un reporte (YYYYMMDD-HHMMSS) a Date ISO, o null. */
function parseSlugDate(slug) {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(slug);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Lista las ejecuciones de tests.
 */
function listTestRuns() {
  const reportsDir = path.join(ROOT, 'reports');
  const cucumberDir = path.join(reportsDir, 'cucumber');
  const runs = [];

  if (fs.existsSync(reportsDir)) {
    for (const name of fs.readdirSync(reportsDir)) {
      if (!name.startsWith('playwright-report-')) continue;
      const idx = path.join(reportsDir, name, 'index.html');
      if (!fs.existsSync(idx)) continue;
      const st = safeStat(idx);
      const slug = name.substring('playwright-report-'.length);
      runs.push({
        id: name,
        slug,
        type: 'playwright',
        startedAt: parseSlugDate(slug),
        mtime: st ? st.mtimeMs : 0,
        reportPath: 'reports/' + name + '/index.html'
      });
    }
  }

  const addCucumberRun = (htmlFull, jsonFull, name) => {
    const st = safeStat(htmlFull);
    if (!st) return;
    const slugMatch = /^cucumber-report-(\d{8}-\d{6})\.html$/i.exec(name);
    const slug = slugMatch ? slugMatch[1] : formatSlug(st.mtimeMs);
    const parsed = jsonFull && fs.existsSync(jsonFull) ? parseCucumberReport(jsonFull) : parseCucumberReport();
    runs.push({
      id: name,
      slug,
      type: 'cucumber',
      startedAt: slugMatch ? parseSlugDate(slug) : new Date(st.mtimeMs).toISOString(),
      mtime: st.mtimeMs,
      reportPath: path.relative(ROOT, htmlFull).replace(/\\/g, '/'),
      tests: parsed ? parsed.totals.totalScenarios : null,
      passed: parsed ? parsed.totals.scenariosPassed : null,
      failed: parsed ? parsed.totals.scenariosFailed : null,
      skipped: parsed ? parsed.totals.scenariosSkipped : null
    });
  };

  if (fs.existsSync(cucumberDir)) {
    for (const name of fs.readdirSync(cucumberDir)) {
      if (!/^cucumber-report-\d{8}-\d{6}\.html$/i.test(name)) continue;
      const slug = name.replace(/^cucumber-report-/, '').replace(/\.html$/i, '');
      addCucumberRun(
        path.join(cucumberDir, name),
        path.join(cucumberDir, 'cucumber-report-' + slug + '.json'),
        name
      );
    }
  }

  // Si todavía no hay copias fechadas, muestra al menos el último reporte BDD.
  const hasCucumberRuns = runs.some((run) => run.type === 'cucumber');
  if (!hasCucumberRuns) {
    const staticHtml = path.join(cucumberDir, 'cucumber-report.html');
    if (fs.existsSync(staticHtml)) {
      addCucumberRun(staticHtml, path.join(cucumberDir, 'cucumber-report.json'), 'cucumber-report.html');
    }
  }

  runs.sort((a, b) => b.mtime - a.mtime);

  // Métricas de reportes Playwright anteriores. El reporte más reciente se
  // omite porque sus métricas ya vienen de reports/results.json (overview).
  const playwrightRuns = runs.filter((run) => run.type === 'playwright');
  const latestPlaywright = playwrightRuns.reduce((best, run) => (!best || run.mtime > best.mtime ? run : best), null);
  for (const run of playwrightRuns) {
    if (latestPlaywright && run === latestPlaywright) continue;
    const reportDir = path.join(ROOT, run.reportPath.replace(/\/index\.html$/i, ''));
    const stats = readPlaywrightReportStats(reportDir);
    if (stats) {
      run.tests = stats.total;
      run.passed = stats.passed;
      run.failed = stats.failed;
      run.skipped = stats.skipped;
    }
  }

  const summaries = listScanFiles().filter((s) => s.kind === 'framework');
  const WINDOW = 30 * 60 * 1000;
  for (const run of runs) {
    let best = null;
    let bestDiff = Infinity;
    for (const s of summaries) {
      const diff = Math.abs(s.mtime - run.mtime);
      if (diff < bestDiff) { bestDiff = diff; best = s; }
    }
    if (best && bestDiff <= WINDOW) {
      run.url = best.url;
      run.pages = best.pages;
      if (run.tests == null) run.tests = best.tests;
      run.summaryFile = best.file;
    }
  }

  return runs;
}

// ------------------------------------------------------------------
// Jobs de ejecución de tests
// ------------------------------------------------------------------

const jobs = new Map();
let jobSeq = 0;

function startTestJob() {
  const id = 'job' + (++jobSeq);
  const job = { id, status: 'running', output: '', exitCode: null, started: Date.now(), finished: null };
  jobs.set(id, job);

  const cwd = path.join(ROOT, 'reports', 'generated-tests');
  const configFile = path.join(cwd, 'playwright.config.ts');
  if (!fs.existsSync(configFile)) {
    job.status = 'error';
    job.exitCode = 1;
    job.finished = Date.now();
    job.output = 'No hay tests generados. Ejecuta primero la opcion [4] (Generar / Ejecutar Tests).';
    return job;
  }

  const child = spawn('npx playwright test --config=playwright.config.ts', {
    cwd,
    shell: true,
    env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' }
  });
  child.stdout.on('data', (d) => { job.output += d.toString(); });
  child.stderr.on('data', (d) => { job.output += d.toString(); });
  child.on('close', (code) => {
    job.status = code === 0 ? 'done' : 'failed';
    job.exitCode = code;
    job.finished = Date.now();
  });
  child.on('error', (err) => {
    job.status = 'error';
    job.exitCode = -1;
    job.finished = Date.now();
    job.output += '\n' + err.message;
  });
  return job;
}

// ------------------------------------------------------------------
// Archivos estáticos
// ------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip'
};

function serveStatic(res, urlPath) {
  // /reports/* y /test-results/* se sirven desde el proyecto.
  const isReports = urlPath === '/reports' || urlPath.startsWith('/reports/');
  const isTestResults = urlPath === '/test-results' || urlPath.startsWith('/test-results/');
  const baseDir = isReports
    ? path.join(ROOT, 'reports')
    : isTestResults
      ? path.join(ROOT, 'test-results')
      : DASHBOARD_DIR;

  let rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  if (isReports) rel = rel.replace(/^reports\/?/, '');
  if (isTestResults) rel = rel.replace(/^test-results\/?/, '');
  if (rel === '') rel = 'index.html';

  const full = path.resolve(baseDir, rel);
  if (full !== baseDir && !full.startsWith(baseDir + path.sep)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  const st = safeStat(full);
  if (!st || !st.isFile()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  const ext = path.extname(full).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  const stream = fs.createReadStream(full);
  stream.on('error', () => { try { res.destroy(); } catch { /* ignore */ } });
  stream.pipe(res);
}

// ------------------------------------------------------------------
// Router
// ------------------------------------------------------------------

async function handle(req, res) {
  const parsed = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(parsed.pathname);
  const method = req.method || 'GET';

  // API
  if (pathname === '/api/overview' && method === 'GET') {
    try { return sendJson(res, 200, buildOverview()); }
    catch (e) { return sendJson(res, 500, { error: String(e) }); }
  }

  if (pathname === '/api/scans' && method === 'GET') {
    try { return sendJson(res, 200, { scans: listScanFiles() }); }
    catch (e) { return sendJson(res, 500, { error: String(e) }); }
  }

  if (pathname === '/api/scan' && method === 'GET') {
    const full = resolveScanPath(parsed.searchParams.get('file'));
    if (!full || !fs.existsSync(full)) return sendJson(res, 404, { error: 'Escaneo no encontrado' });
    try {
      const data = readJsonFile(full);
      return sendJson(res, 200, { file: path.relative(ROOT, full).replace(/\\/g, '/'), data });
    } catch (e) {
      return sendJson(res, 500, { error: 'No se pudo leer el JSON: ' + String(e) });
    }
  }

  if (pathname === '/api/scan' && method === 'DELETE') {
    const full = resolveScanPath(parsed.searchParams.get('file'));
    if (!full || !fs.existsSync(full)) return sendJson(res, 404, { error: 'Escaneo no encontrado' });
    try {
      fs.unlinkSync(full);
      scansCache = { at: 0, data: [] };
      return sendJson(res, 200, { ok: true, file: path.relative(ROOT, full).replace(/\\/g, '/') });
    } catch (e) {
      return sendJson(res, 500, { error: 'No se pudo eliminar: ' + String(e) });
    }
  }

  if (pathname === '/api/tests' && method === 'GET') {
    try { return sendJson(res, 200, getTestsInfo()); }
    catch (e) { return sendJson(res, 500, { error: String(e) }); }
  }

  if (pathname === '/api/runs' && method === 'GET') {
    try { return sendJson(res, 200, { runs: listTestRuns() }); }
    catch (e) { return sendJson(res, 500, { error: String(e) }); }
  }

  if (pathname === '/api/tests/run' && method === 'POST') {
    await readBody(req);
    const job = startTestJob();
    return sendJson(res, 200, { id: job.id, status: job.status });
  }

  if (pathname.startsWith('/api/tests/run/') && method === 'GET') {
    const id = pathname.substring('/api/tests/run/'.length);
    const job = jobs.get(id);
    if (!job) return sendJson(res, 404, { error: 'Job no encontrado' });
    return sendJson(res, 200, { id: job.id, status: job.status, exitCode: job.exitCode, output: job.output });
  }

  if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Endpoint no encontrado' });

  // Estáticos
  if (method === 'GET') return serveStatic(res, pathname);
  res.writeHead(405); res.end('Method not allowed');
}

// ------------------------------------------------------------------
// Arranque (con reintento de puerto)
// ------------------------------------------------------------------

process.on('uncaughtException', (e) => {
  console.error('Error no controlado (el panel sigue activo):', e && e.message ? e.message : e);
});
process.on('unhandledRejection', (e) => {
  console.error('Promesa rechazada (el panel sigue activo):', e);
});

function openBrowser(url) {
  try {
    if (process.platform === 'win32') exec(`start "" "${url}"`); else if (process.platform === 'darwin') exec(`open "${url}"`);
    else exec(`xdg-open "${url}"`); } catch { /* ignorar */ } }  function start(port, attempt = 0) { const server = http.createServer((req, res) => { handle(req, res).catch((e) => { try { sendJson(res, 500, { error: String(e) }); } catch { /* ignore */ } }); });  server.on('error', (err) => { if (err.code === 'EADDRINUSE' && attempt < 10) { start(port + 1, attempt + 1); } else { console.error('No se pudo iniciar el panel:', err.message); process.exit(1); } });  server.listen(port, () => { const url = `http://localhost:${port}`;
    console.log('');
    console.log('  ============================================================');
    console.log('   CACHAI-QA - Panel Web');
    console.log('  ============================================================');
    console.log('   URL:    ' + url);
    console.log('   Cierra esta ventana para detener el panel.');
    console.log('  ============================================================');
    console.log('');
    if (!process.env.DASHBOARD_NO_OPEN) openBrowser(url);
  });
}

start(BASE_PORT);