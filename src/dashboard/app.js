'use strict';

/* ------------------------------------------------------------------ *
 * Estado global
 * ------------------------------------------------------------------ */
const state = {
  theme: localStorage.getItem('cq.theme') || 'system',
  lang: localStorage.getItem('cq.lang') || 'es',
  scans: [],
  tests: null,
  runs: [],
  jobTimer: null
};

/* ------------------------------------------------------------------ *
 * i18n
 * ------------------------------------------------------------------ */
const I18N = {
  es: {
    'app.subtitle': 'Panel de escaneos y tests',
    'common.refresh': 'Actualizar',
    'common.view': 'Ver',
    'common.delete': 'Eliminar',
    'common.close': 'Cerrar',
    'common.cancel': 'Cancelar',
    'common.confirm': 'Confirmar',
    'settings.theme.system': 'Sistema',
    'settings.theme.light': 'Claro',
    'settings.theme.dark': 'Oscuro',
    'tabs.scans': 'Escaneos',
    'tabs.tests': 'Tests',
    'tabs.runs': 'Ejecuciones',
    'scans.title': 'Escaneos guardados',
    'scans.empty': 'No hay escaneos todavía.',
    'scans.file': 'Archivo',
    'scans.url': 'URL',
    'scans.pages': 'Páginas',
    'scans.links': 'Enlaces',
    'scans.tests': 'Tests',
    'scans.errors': 'Errores',
    'scans.size': 'Tamaño',
    'scans.date': 'Fecha',
    'scans.kind.crawl': 'Crawler',
    'scans.kind.framework': 'Framework',
    'scans.kind.unknown': 'Desconocido',
    'scans.deleteConfirm': '¿Eliminar el escaneo "{name}"? Esta acción no se puede deshacer.',
    'confirm.title': 'Confirmar eliminación',
    'scans.detail': 'Detalle del escaneo',
    'scans.noLinks': 'Este archivo no contiene enlaces listados.',
    'scans.showing': 'Mostrando los primeros {n} de {total} enlaces.',
    'tests.title': 'Tests',
    'tests.spec': 'Especificación generada',
    'tests.run': 'Ejecutar tests',
    'tests.running': 'Ejecutando…',
    'tests.reports': 'Reportes HTML',
    'tests.output': 'Salida',
    'tests.noSpec': 'No hay tests generados. Ejecuta primero la opción [2] o [3].',
    'tests.noReports': 'Todavía no hay reportes.',
    'tests.open': 'Abrir',
    'runs.title': 'Ejecuciones de tests',
    'runs.empty': 'Todavía no hay ejecuciones de tests.',
    'runs.date': 'Fecha',
    'runs.pages': 'Páginas',
    'runs.tests': 'Tests',
    'runs.open': 'Abrir reporte',
    'runs.preview': 'Ver aquí',
    'runs.noUrl': 'URL no disponible',
    'tests.status.done': 'Completado',
    'tests.status.failed': 'Con fallos',
    'tests.status.running': 'Ejecutando',
    'tests.status.error': 'Error',
    'toast.deleted': 'Escaneo eliminado',
    'toast.error': 'Ocurrió un error',
    'toast.refreshed': 'Actualizado'
  },
  en: {
    'app.subtitle': 'Scans and tests dashboard',
    'common.refresh': 'Refresh',
    'common.view': 'View',
    'common.delete': 'Delete',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'settings.theme.system': 'System',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'tabs.scans': 'Scans',
    'tabs.tests': 'Tests',
    'tabs.runs': 'Runs',
    'scans.title': 'Saved scans',
    'scans.empty': 'No scans yet.',
    'scans.file': 'File',
    'scans.url': 'URL',
    'scans.pages': 'Pages',
    'scans.links': 'Links',
    'scans.tests': 'Tests',
    'scans.errors': 'Errors',
    'scans.size': 'Size',
    'scans.date': 'Date',
    'scans.kind.crawl': 'Crawler',
    'scans.kind.framework': 'Framework',
    'scans.kind.unknown': 'Unknown',
    'scans.deleteConfirm': 'Delete scan "{name}"? This cannot be undone.',
    'confirm.title': 'Confirm deletion',
    'scans.detail': 'Scan detail',
    'scans.noLinks': 'This file does not contain listed links.',
    'scans.showing': 'Showing the first {n} of {total} links.',
    'tests.title': 'Tests',
    'tests.spec': 'Generated spec',
    'tests.run': 'Run tests',
    'tests.running': 'Running…',
    'tests.reports': 'HTML reports',
    'tests.output': 'Output',
    'tests.noSpec': 'No generated tests. Run option [2] or [3] first.',
    'tests.noReports': 'No reports yet.',
    'tests.open': 'Open',
    'runs.title': 'Test runs',
    'runs.empty': 'No test runs yet.',
    'runs.date': 'Date',
    'runs.pages': 'Pages',
    'runs.tests': 'Tests',
    'runs.open': 'Open report',
    'runs.preview': 'Preview',
    'runs.noUrl': 'URL unavailable',
    'tests.status.done': 'Completed',
    'tests.status.failed': 'Failed',
    'tests.status.running': 'Running',
    'tests.status.error': 'Error',
    'toast.deleted': 'Scan deleted',
    'toast.error': 'Something went wrong',
    'toast.refreshed': 'Refreshed'
  }
};

function t(key, vars) {
  let s = (I18N[state.lang] && I18N[state.lang][key]) || (I18N.es[key] || key);
  if (vars) for (const k of Object.keys(vars)) s = s.replace('{' + k + '}', vars[k]);
  return s;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtBytes(n) {
  if (!n && n !== 0) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(2) + ' MB';
}

function fmtDate(ms) {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString(state.lang === 'en' ? 'en-US' : 'es-CL');
  } catch { return '—'; }
}

let toastTimer = null;
function toast(msg, isError) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast' + (isError ? ' error' : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ------------------------------------------------------------------ *
 * Tema e idioma
 * ------------------------------------------------------------------ */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  $$('[data-theme-set]').forEach((b) => b.classList.toggle('active', b.dataset.themeSet === state.theme));
}

function applyLang() {
  document.documentElement.setAttribute('lang', state.lang);
  $$('[data-lang-set]').forEach((b) => b.classList.toggle('active', b.dataset.langSet === state.lang));
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  renderScans();
  renderTests();
  renderRuns();
}

/* ------------------------------------------------------------------ *
 * Escaneos
 * ------------------------------------------------------------------ */
async function loadScans() {
  try {
    const res = await fetch('/api/scans');
    const json = await res.json();
    state.scans = json.scans || [];
    renderScans();
  } catch (e) {
    toast(t('toast.error'), true);
  }
}

function kindLabel(kind) {
  if (kind === 'crawl') return t('scans.kind.crawl');
  if (kind === 'framework') return t('scans.kind.framework');
  return t('scans.kind.unknown');
}

function renderScans() {
  const list = $('#scans-list');
  const empty = $('#scans-empty');
  if (!list) return;

  $('#scans-count').textContent = state.scans.length;
  if (state.scans.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = state.scans.map((s) => {
    const meta = [];
    meta.push(`<span class="badge">${esc(kindLabel(s.kind))}</span>`);
    if (s.pages != null) meta.push(`<span class="badge">${t('scans.pages')}: ${esc(s.pages)}</span>`);
    if (s.links != null) meta.push(`<span class="badge">${t('scans.links')}: ${esc(s.links)}</span>`);
    if (s.tests != null) meta.push(`<span class="badge">${t('scans.tests')}: ${esc(s.tests)}</span>`);
    if (s.errors != null && s.errors > 0) meta.push(`<span class="badge fail">${t('scans.errors')}: ${esc(s.errors)}</span>`);
    meta.push(`<span class="badge">${esc(fmtBytes(s.size))}</span>`);
    meta.push(`<span class="badge">${esc(fmtDate(s.mtime))}</span>`);

    return `
      <article class="scan">
        <div class="scan-top">
          <div>
            <div class="scan-name">${esc(s.name)}</div>
            <div class="scan-url">${esc(s.url || '—')}</div>
          </div>
          <div class="scan-actions">
            <button type="button" class="btn" data-view="${esc(s.file)}">${t('common.view')}</button>
            <button type="button" class="btn danger" data-delete="${esc(s.file)}">${t('common.delete')}</button>
          </div>
        </div>
        <div class="scan-meta">${meta.join('')}</div>
      </article>`;
  }).join('');
}

async function openScan(file) {
  try {
    const res = await fetch('/api/scan?file=' + encodeURIComponent(file));
    const json = await res.json();
    if (json.error) { toast(json.error, true); return; }
    renderScanDetail(file, json.data);
  } catch {
    toast(t('toast.error'), true);
  }
}

function renderScanDetail(file, data) {
  const rows = [];
  const summary = [];
  if (typeof data.baseUrl === 'string') summary.push(['URL', data.baseUrl]);
  if (data.timestamp) summary.push([t('scans.date'), data.timestamp]);
  if (data.totalPages != null) summary.push([t('scans.pages'), data.totalPages]);
  if (data.totalLinks != null) summary.push([t('scans.links'), data.totalLinks]);
  if (data.metadata) {
    if (data.metadata.targetUrl) summary.push(['URL', data.metadata.targetUrl]);
    if (data.metadata.pagesScanned != null) summary.push([t('scans.pages'), data.metadata.pagesScanned]);
    if (data.metadata.testsGenerated != null) summary.push([t('scans.tests'), data.metadata.testsGenerated]);
    if (data.metadata.mode) summary.push(['Modo', data.metadata.mode]);
  }

  const items = Array.isArray(data.links) ? data.links : (Array.isArray(data.pages) ? data.pages : []);
  const LIMIT = 300;
  let table = '';
  if (items.length > 0) {
    const slice = items.slice(0, LIMIT);
    rows.push(`<table><thead><tr><th>URL</th><th>Texto / Título</th></tr></thead><tbody>`);
    for (const it of slice) {
      rows.push(`<tr><td class="mono">${esc(it.url || it.href || '')}</td><td>${esc(it.text || it.title || '')}</td></tr>`);
    }
    rows.push('</tbody></table>');
    if (items.length > LIMIT) {
      rows.push(`<p class="muted">${esc(t('scans.showing', { n: LIMIT, total: items.length }))}</p>`);
    }
    table = rows.join('');
  } else {
    table = `<p class="empty">${esc(t('scans.noLinks'))}</p>`;
  }

  const summaryHtml = summary.length
    ? `<div class="scan-meta" style="margin-bottom:14px">` +
      summary.map(([k, v]) => `<span class="badge">${esc(k)}: ${esc(v)}</span>`).join('') + `</div>`
    : '';

  openModal(file, summaryHtml + table);
}

async function deleteScan(file) {
  const scan = state.scans.find((s) => s.file === file);
  const msg = t('scans.deleteConfirm', { name: scan ? scan.name : file });
  const ok = await confirmAction(msg);
  if (!ok) return;
  try {
    const res = await fetch('/api/scan?file=' + encodeURIComponent(file), { method: 'DELETE' });
    const json = await res.json();
    if (json.error) { toast(json.error, true); return; }
    toast(t('toast.deleted'));
    loadScans();
  } catch {
    toast(t('toast.error'), true);
  }
}

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */
async function loadTests() {
  try {
    const res = await fetch('/api/tests');
    state.tests = await res.json();
    renderTests();
  } catch {
    toast(t('toast.error'), true);
  }
}

function renderTests() {
  if (!state.tests) return;
  const { spec, reports } = state.tests;

  $('#tests-spec-path').textContent = spec.exists ? spec.path : '';
  $('#tests-empty').hidden = spec.exists;

  const cases = $('#tests-cases');
  cases.innerHTML = (spec.tests || []).map((n) => `<li>${esc(n)}</li>`).join('');

  const runBtn = $('#run-tests');
  runBtn.disabled = !spec.exists || !spec.hasConfig;

  const list = $('#tests-reports');
  $('#reports-empty').hidden = (reports || []).length > 0;
  list.innerHTML = (reports || []).map((r) => `
    <li>
      <span>${esc(r.name)}</span>
      <a href="${esc(r.path)}" target="_blank" rel="noopener">${t('tests.open')}</a>
    </li>`).join('');
}

async function runTests() {
  const btn = $('#run-tests');
  const card = $('#tests-output-card');
  const out = $('#tests-output');
  const status = $('#tests-status');

  btn.disabled = true;
  btn.textContent = t('tests.running');
  card.hidden = false;
  out.textContent = '';
  status.className = 'badge run';
  status.textContent = t('tests.status.running');

  try {
    const res = await fetch('/api/tests/run', { method: 'POST' });
    const json = await res.json();
    pollJob(json.id);
  } catch {
    toast(t('toast.error'), true);
    btn.disabled = false;
    btn.textContent = t('tests.run');
  }
}

function pollJob(id) {
  clearInterval(state.jobTimer);
  state.jobTimer = setInterval(async () => {
    try {
      const res = await fetch('/api/tests/run/' + encodeURIComponent(id));
      const job = await res.json();
      const out = $('#tests-output');
      out.textContent = job.output || '';
      out.scrollTop = out.scrollHeight;

      const status = $('#tests-status');
      if (job.status === 'running') {
        status.className = 'badge run';
        status.textContent = t('tests.status.running');
      } else {
        clearInterval(state.jobTimer);
        status.className = 'badge ' + (job.status === 'done' ? 'ok' : 'fail');
        status.textContent = t('tests.status.' + job.status);
        const btn = $('#run-tests');
        btn.disabled = false;
        btn.textContent = t('tests.run');
        loadTests();
      }
    } catch {
      clearInterval(state.jobTimer);
    }
  }, 1200);
}

/* ------------------------------------------------------------------ *
 * Ejecuciones de tests
 * ------------------------------------------------------------------ */
async function loadRuns() {
  try {
    const res = await fetch('/api/runs');
    const json = await res.json();
    state.runs = json.runs || [];
    renderRuns();
  } catch {
    toast(t('toast.error'), true);
  }
}

function renderRuns() {
  const list = $('#runs-list');
  const empty = $('#runs-empty');
  if (!list) return;

  const runs = state.runs || [];
  $('#runs-count').textContent = runs.length;
  if (runs.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = runs.map((r) => {
    const meta = [];
    meta.push(`<span class="badge">${t('runs.date')}: ${esc(fmtDate(r.mtime))}</span>`);
    if (r.pages != null) meta.push(`<span class="badge">${t('runs.pages')}: ${esc(r.pages)}</span>`);
    if (r.tests != null) meta.push(`<span class="badge">${t('runs.tests')}: ${esc(r.tests)}</span>`);

    return `
      <article class="scan">
        <div class="scan-top">
          <div>
            <div class="scan-name">${esc(r.id)}</div>
            <div class="scan-url">${esc(r.url || t('runs.noUrl'))}</div>
          </div>
          <div class="scan-actions">
            <button type="button" class="btn" data-run-preview="${esc(r.reportPath)}">${t('runs.preview')}</button>
            <a class="btn primary" href="${esc(r.reportPath)}" target="_blank" rel="noopener">${t('runs.open')}</a>
          </div>
        </div>
        <div class="scan-meta">${meta.join('')}</div>
      </article>`;
  }).join('');
}

function openRunPreview(reportPath) {
  openModal(t('runs.open'), `<iframe class="report-frame" src="${esc(reportPath)}" title="report"></iframe>`, true);
}

/* ------------------------------------------------------------------ *
 * Modal
 * ------------------------------------------------------------------ */
function openModal(title, bodyHtml, wide) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHtml;
  $('#modal .modal-box').classList.toggle('wide', !!wide);
  $('#modal').hidden = false;
}
function closeModal() {
  $('#modal').hidden = true;
  $('#modal-body').innerHTML = '';
  $('#modal .modal-box').classList.remove('wide');
}

let confirmResolver = null;
function confirmAction(message, okLabel) {
  return new Promise((resolve) => {
    confirmResolver = resolve;
    $('#confirm-title').textContent = t('confirm.title');
    $('#confirm-text').textContent = message;
    $('#confirm-ok').textContent = okLabel || t('common.delete');
    $('#confirm-cancel').textContent = t('common.cancel');
    $('#confirm').hidden = false;
  });
}
function closeConfirm(result) {
  $('#confirm').hidden = true;
  if (confirmResolver) { const r = confirmResolver; confirmResolver = null; r(result); }
}

/* ------------------------------------------------------------------ *
 * Tabs
 * ------------------------------------------------------------------ */
function setTab(name) {
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + name));
  if (name === 'tests') loadTests();
  if (name === 'runs') loadRuns();
}

/* ------------------------------------------------------------------ *
 * Eventos
 * ------------------------------------------------------------------ */
function bind() {
  $$('[data-theme-set]').forEach((b) => b.addEventListener('click', () => {
    state.theme = b.dataset.themeSet;
    localStorage.setItem('cq.theme', state.theme);
    applyTheme();
  }));

  $$('[data-lang-set]').forEach((b) => b.addEventListener('click', () => {
    state.lang = b.dataset.langSet;
    localStorage.setItem('cq.lang', state.lang);
    applyLang();
  }));

  $$('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  $('#refresh').addEventListener('click', async () => {
    await loadScans();
    if (document.querySelector('#panel-tests').classList.contains('active')) await loadTests();
    if (document.querySelector('#panel-runs').classList.contains('active')) await loadRuns();
    toast(t('toast.refreshed'));
  });

  $('#scans-list').addEventListener('click', (e) => {
    const view = e.target.closest('[data-view]');
    const del = e.target.closest('[data-delete]');
    if (view) openScan(view.dataset.view);
    if (del) deleteScan(del.dataset.delete);
  });

  $('#runs-list').addEventListener('click', (e) => {
    const prev = e.target.closest('[data-run-preview]');
    if (prev) openRunPreview(prev.dataset.runPreview);
  });

  $('#run-tests').addEventListener('click', runTests);
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
  $('#confirm-ok').addEventListener('click', () => closeConfirm(true));
  $('#confirm-cancel').addEventListener('click', () => closeConfirm(false));
  $('#confirm').addEventListener('click', (e) => { if (e.target.id === 'confirm') closeConfirm(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#confirm').hidden) closeConfirm(false);
    else closeModal();
  });
}

/* ------------------------------------------------------------------ *
 * Init
 * ------------------------------------------------------------------ */
function init() {
  applyTheme();
  bind();
  applyLang();
  loadScans();
}

init();
