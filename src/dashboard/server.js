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

/** Lee y parsea un JSON ignorando un posible BOM inicial. */
function readJsonFile(full) {
  let text = fs.readFileSync(full, 'utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  return JSON.parse(text);
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
      url: obj.metadata.targetUrl || '',
      pages: obj.metadata.pagesScanned,
      tests: obj.metadata.testsGenerated,
      mode: obj.metadata.mode,
      timestamp: obj.metadata.timestamp
    };
  }
  return null;
}

function listScanFiles() {
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
  return found.sort((a, b) => b.mtime - a.mtime);
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

function getTestsInfo() {
  const genDir = path.join(ROOT, 'reports', 'generated-tests');
  const specPath = path.join(genDir, 'cachai-tests.spec.ts');
  const configPath = path.join(genDir, 'playwright.config.ts');

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
  const reports = [];
  if (fs.existsSync(reportsDir)) {
    for (const name of fs.readdirSync(reportsDir)) {
      if (!name.startsWith('playwright-report-')) continue;
      const idx = path.join(reportsDir, name, 'index.html');
      if (fs.existsSync(idx)) {
        const st = safeStat(idx);
        reports.push({ name, path: 'reports/' + name + '/index.html', mtime: st ? st.mtimeMs : 0 });
      }
    }
  }
  reports.sort((a, b) => b.mtime - a.mtime);
  return { spec, reports };
}

/** Convierte el slug de un reporte (YYYYMMDD-HHMMSS) a Date ISO, o null. */
function parseSlugDate(slug) {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(slug);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Lista las ejecuciones de tests (opcion 4 y el boton del panel).
 * Cada ejecucion se detecta por una carpeta reports/playwright-report-* y se
 * enriquece con el resumen JSON del framework mas cercano en el tiempo.
 */
function listTestRuns() {
  const reportsDir = path.join(ROOT, 'reports');
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
        startedAt: parseSlugDate(slug),
        mtime: st ? st.mtimeMs : 0,
        reportPath: 'reports/' + name + '/index.html'
      });
    }
  }

  runs.sort((a, b) => b.mtime - a.mtime);

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
      run.tests = best.tests;
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
  '.ico': 'image/x-icon'
};

function serveStatic(res, urlPath) {
  // /reports/* se sirve desde la carpeta reports del proyecto (para abrir el reporte de Playwright)
  const isReports = urlPath === '/reports' || urlPath.startsWith('/reports/');
  const baseDir = isReports ? path.join(ROOT, 'reports') : DASHBOARD_DIR;

  let rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  if (isReports) rel = rel.replace(/^reports\/?/, '');
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
    if (process.platform === 'win32') exec(`start "" "${url}"`);
    else if (process.platform === 'darwin') exec(`open "${url}"`);
    else exec(`xdg-open "${url}"`);
  } catch { /* ignorar */ }
}

function start(port, attempt = 0) {
  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      try { sendJson(res, 500, { error: String(e) }); } catch { /* ignore */ }
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < 10) {
      start(port + 1, attempt + 1);
    } else {
      console.error('No se pudo iniciar el panel:', err.message);
      process.exit(1);
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
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
