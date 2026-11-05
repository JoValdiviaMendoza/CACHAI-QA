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
 *
 * Uso: node cli/report-defects.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');

const TIMEOUT_RE = /timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|net::ERR_|NS_ERROR_NET/i;
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

/** URL base del último resumen generado por from-scan.ts. */
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
  const byUrl = defect.tipo === 'sin-verificar' || defect.firma === 'Enlace roto (HTTP 404)';
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
        const pagePath = (String(spec.title || '').match(/«([^»]+)»/) || [])[1] || '';
        const fromMessage = (stripAnsi(message).match(/https?:\/\/[^\s)"']+/) || [])[0] || '';
        const { tipo, firma } = classify(message);
        addDefect(store, {
          tipo,
          motor: 'Playwright',
          url: normalizeUrl(fromMessage || pagePath, targetUrl),
          firma,
          navegadores: test.projectName ? [String(test.projectName)] : []
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

function collectCucumber(store, targetUrl) {
  const candidates = [
    path.join(REPORTS, 'cucumber', 'cucumber-report.json'),
    path.join(REPORTS, 'cucumber-report.json')
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) return 0;
  const features = readJson(file);
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

function main() {
  const targetUrl = latestTargetUrl();
  const store = new Map();
  // Permite limitar el reporte al motor que se acaba de ejecutar.
  const only = String(process.argv[2] || 'both').toLowerCase();
  const includePlaywright = only !== 'cucumber';
  const includeCucumber = only !== 'playwright';
  const pwFailed = includePlaywright ? collectPlaywright(store, targetUrl) : 0;
  const cbFailed = includeCucumber ? collectCucumber(store, targetUrl) : 0;

  const all = Array.from(store.values());
  const defects = all.filter((item) => item.tipo === 'defecto').sort((a, b) => b.repeticiones - a.repeticiones);
  const unverified = all.filter((item) => item.tipo === 'sin-verificar');

  let host = 'sitio';
  try {
    host = new URL(targetUrl).hostname.replace(/^www\./, '');
  } catch { /* usar valor por defecto */ }

  const lines = [];
  lines.push(`# Defectos detectados en ${targetUrl || host}`);
  lines.push('');
  lines.push(`Generado: ${new Date().toLocaleString('es-CL')}`);
  lines.push('');
  lines.push(`- Fallos brutos: **${pwFailed + cbFailed}** (Playwright ${pwFailed}, Cucumber ${cbFailed})`);
  lines.push(`- Defectos únicos: **${defects.length}**`);
  lines.push(`- Comprobaciones sin verificar (timeouts): **${unverified.length}**`);
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
  const outFile = path.join(REPORTS, `defectos-${host}-${slugDate()}.md`);
  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');

  console.log('');
  console.log('=== DEFECTOS ÚNICOS ===');
  console.log(`Fallos brutos:      ${pwFailed + cbFailed}`);
  console.log(`Defectos únicos:    ${defects.length}`);
  console.log(`Sin verificar:      ${unverified.length}`);
  console.log(`Reporte:            ${path.relative(ROOT, outFile).replace(/\\/g, '/')}`);
}

main();
