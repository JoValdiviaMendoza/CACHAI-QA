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
  overview: null,
  scanFilter: 'quick',
  runFilter: 'playwright',
  runSearch: { playwright: '', cucumber: '' },
  runStatus: { playwright: 'all' },
  homeSegment: 'error',
  homeShowAll: false,
  jobTimer: null
};

/* ------------------------------------------------------------------ *
 * i18n
 * ------------------------------------------------------------------ */
const I18N = {
  es: {
    'app.subtitle': 'Panel de escaneos y ejecuciones',
    'app.h1': 'Panel de escaneos y pruebas CACHAI-QA',
    'app.title': 'CACHAI-QA · Panel de escaneos y pruebas',
    'home.title': 'Resumen general',
    'common.refresh': 'Actualizar',
    'common.view': 'Ver',
    'common.delete': 'Eliminar',
    'common.close': 'Cerrar',
    'common.cancel': 'Cancelar',
    'common.confirm': 'Confirmar',
    'settings.theme.system': 'Sistema',
    'settings.theme.light': 'Claro',
    'settings.theme.dark': 'Oscuro',
    'tabs.home': 'Inicio',
    'tabs.scans': 'Escaneos',
    'tabs.runs': 'Ejecuciones',
    'home.emptyTitle': 'Sin datos todavía',
    'home.empty': 'Ejecuta un escaneo o una prueba desde la consola (opción 1, 2, 3 o 4) y pulsa Actualizar.',
    'home.detail': 'Ver desglose completo',
    'home.detailTitle': 'Desglose completo de errores',
    'home.report': 'Abrir reporte',
    'home.lastRun': 'Última ejecución: {date} · {engine}',
    'home.health.optimal': '🟢 Página Óptima',
    'home.health.regular': '🟡 Página Regular',
    'home.health.critical': '🔴 Necesita Atención',
    'home.kpi.pages': 'Páginas evaluadas',
    'home.kpi.elements': 'Elementos / pruebas',
    'home.kpi.success': 'Correctos',
    'home.kpi.errors': 'Errores',
    'home.kpi.warnings': 'Advertencias / omitidos',
    'home.errors.title': 'Errores detectados',
    'home.errors.empty': 'No hay errores registrados en la última ejecución.',
    'home.errors.segmentEmpty': 'El segmento seleccionado no contiene errores.',
    'home.errors.showAll': 'Mostrar los {n} errores',
    'home.segment.success': 'Éxitos',
    'home.segment.warning': 'Advertencias',
    'home.segment.error': 'Errores',
    'home.source.playwright': 'Playwright',
    'home.source.cucumber': 'Cucumber',
    'home.source.scan': 'Escaneo',
    'scans.title': 'Escaneos guardados',
    'scans.empty': 'No hay escaneos en esta categoría.',
    'scans.filter.quick': '⚡ Rápido',
    'scans.filter.full': '🌐 Completo',
    'scans.filter.custom': '🎯 Personalizado',
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
    'tests.spec': 'Especificación generada (Playwright)',
    'tests.run': 'Ejecutar tests',
    'tests.running': 'Ejecutando…',
    'tests.reports': 'Reportes HTML',
    'tests.output': 'Salida',
    'tests.noSpec': 'No hay tests generados. Ejecuta primero la opción [4].',
    'tests.noReports': 'Todavía no hay reportes.',
    'tests.showing': 'Mostrando los primeros {n} de {total} tests.',
    'tests.open': 'Abrir',
    'tests.status.done': 'Completado',
    'tests.status.failed': 'Con fallos',
    'tests.status.running': 'Ejecutando',
    'tests.status.error': 'Error',
    'runs.title': 'Ejecuciones de tests',
    'runs.empty': 'Todavía no hay ejecuciones de tests.',
    'runs.date': 'Fecha',
    'runs.pages': 'Páginas',
    'runs.tests': 'Tests',
    'runs.open': 'Abrir reporte',
    'runs.preview': 'Ver aquí',
    'runs.noUrl': 'URL no disponible',
    'runs.filter.playwright': '🎭 Playwright',
    'runs.filter.cucumber': '🥒 Cucumber',
    'runs.filter.browserstack': '☁️ BrowserStack',
    'runs.results': 'Resultados de la última ejecución',
    'runs.currentReport': 'Ver Reporte HTML',
    'runs.currentReportCucumber': 'Abrir Reporte HTML Actual',
    'runs.traceViewer': 'Abrir Trace Viewer',
    'runs.history.executions': 'Historial de ejecuciones',
    'runs.history.reports': 'Historial de reportes',
    'runs.metric.tests': '🧪 Pruebas',
    'runs.metric.passed': '🟢 Passed',
    'runs.metric.failed': '🔴 Failed',
    'runs.metric.skipped': '⚪ Skipped',
    'runs.metric.scenarios': '📋 Escenarios',
    'runs.metric.success': '🟢 Éxito',
    'runs.metric.failedScenarios': '🔴 Fallidos',
    'runs.metric.skippedScenarios': '⚪ Omitidos',
    'runs.searchPlaywright': 'Buscar ejecución...',
    'runs.searchCucumber': 'Buscar reporte...',
    'runs.status.all': 'Todos los estados',
    'runs.status.failed': 'Con fallos',
    'runs.status.passed': 'Sin fallos',
    'runs.latestExecution': 'Última ejecución',
    'runs.latestReport': 'Último reporte',
    'runs.current': 'Actual',
    'runs.justNow': 'Hace un momento',
    'runs.minuteAgo': 'Hace 1 minuto',
    'runs.minutesAgo': 'Hace {n} minutos',
    'runs.hourAgo': 'Hace 1 hora',
    'runs.hoursAgo': 'Hace {n} horas',
    'runs.dayAgo': 'Hace 1 día',
    'runs.daysAgo': 'Hace {n} días',
    'runs.previousReports': 'Reportes anteriores',
    'runs.previousHint': 'Se excluye la ejecución actual, que se muestra arriba.',
    'runs.playwright.errors': 'Errores técnicos de la última ejecución',
    'runs.playwright.errorsEmpty': 'La última ejecución de Playwright no registró errores.',
    'runs.cucumber.title': 'Cucumber BDD & métricas Gherkin',
    'runs.cucumber.subtitle': 'Resultados y pasos en lenguaje natural.',
    'runs.cucumber.loading': 'Cargando métricas BDD…',
    'runs.cucumber.errors': 'Escenarios fallidos',
    'runs.cucumber.errorsEmpty': 'La última ejecución de Cucumber no registró escenarios fallidos.',
    'runs.cucumber.noMetrics': 'No hay métricas BDD registradas todavía.',
    'runs.cucumber.showing': 'Mostrando los primeros {n} de {total} escenarios.',
    'runs.history.playwright': 'Historial Playwright',
    'runs.history.cucumber': 'Historial Cucumber',
    'runs.empty.playwright': 'No hay ejecuciones de Playwright.',
    'runs.empty.cucumber': 'No hay reportes de Cucumber.',
    'runs.browserstack.title': 'BrowserStack',
    'runs.browserstack.soon': 'Integración con BrowserStack en desarrollo. Próximamente podrás visualizar aquí los resultados de las pruebas ejecutadas en la nube sobre múltiples navegadores y dispositivos reales.',
    'error.location': 'Dirección del error (ubicación)',
    'error.affected': 'URL afectada',
    'error.origin': 'Origen',
    'error.feature': 'Feature',
    'error.failedStep': 'Paso fallido',
    'error.selector': 'Selector afectado',
    'error.diagnosis': 'Código de error (diagnóstico técnico)',
    'error.solution': 'Glosario de solución (recomendación)',
    'error.attachments': 'Evidencias',
    'error.viewVideo': 'Ver Replay',
    'error.viewContext': 'Ver contexto del error',
    'error.viewAttachment': 'Ver adjunto',
    'error.copy': 'Copiar ruta del enlace',
    'error.copied': 'Ruta copiada',
    'error.technical': 'Ver log técnico completo',
    'toast.deleted': 'Escaneo eliminado',
    'toast.error': 'Ocurrió un error',
    'toast.refreshed': 'Actualizado'
  },
  en: {
    'app.subtitle': 'Scans and runs dashboard',
    'app.h1': 'CACHAI-QA scans and tests panel',
    'app.title': 'CACHAI-QA · Scans and tests panel',
    'home.title': 'Overview',
    'common.refresh': 'Refresh',
    'common.view': 'View',
    'common.delete': 'Delete',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'settings.theme.system': 'System',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'tabs.home': 'Home',
    'tabs.scans': 'Scans',
    'tabs.runs': 'Runs',
    'home.emptyTitle': 'No data yet',
    'home.empty': 'Run a scan or test from the console (option 1, 2, 3 or 4) and press Refresh.',
    'home.detail': 'View full breakdown',
    'home.detailTitle': 'Full error breakdown',
    'home.report': 'Open report',
    'home.lastRun': 'Last run: {date} · {engine}',
    'home.health.optimal': '🟢 Optimal Page',
    'home.health.regular': '🟡 Fair Page',
    'home.health.critical': '🔴 Needs Attention',
    'home.kpi.pages': 'Pages evaluated',
    'home.kpi.elements': 'Elements / tests',
    'home.kpi.success': 'Passed',
    'home.kpi.errors': 'Errors',
    'home.kpi.warnings': 'Warnings / skipped',
    'home.errors.title': 'Detected errors',
    'home.errors.empty': 'No errors recorded in the last run.',
    'home.errors.segmentEmpty': 'The selected segment has no errors.',
    'home.errors.showAll': 'Show all {n} errors',
    'home.segment.success': 'Passed',
    'home.segment.warning': 'Warnings',
    'home.segment.error': 'Errors',
    'home.source.playwright': 'Playwright',
    'home.source.cucumber': 'Cucumber',
    'home.source.scan': 'Scan',
    'scans.title': 'Saved scans',
    'scans.empty': 'No scans in this category.',
    'scans.filter.quick': '⚡ Quick',
    'scans.filter.full': '🌐 Full',
    'scans.filter.custom': '🎯 Custom',
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
    'tests.spec': 'Generated specification (Playwright)',
    'tests.run': 'Run tests',
    'tests.running': 'Running…',
    'tests.reports': 'HTML reports',
    'tests.output': 'Output',
    'tests.noSpec': 'No generated tests. Run option [4] first.',
    'tests.noReports': 'No reports yet.',
    'tests.showing': 'Showing the first {n} of {total} tests.',
    'tests.open': 'Open',
    'tests.status.done': 'Completed',
    'tests.status.failed': 'Failed',
    'tests.status.running': 'Running',
    'tests.status.error': 'Error',
    'runs.title': 'Test runs',
    'runs.empty': 'No test runs yet.',
    'runs.date': 'Date',
    'runs.pages': 'Pages',
    'runs.tests': 'Tests',
    'runs.open': 'Open report',
    'runs.preview': 'Preview',
    'runs.noUrl': 'URL unavailable',
    'runs.filter.playwright': '🎭 Playwright',
    'runs.filter.cucumber': '🥒 Cucumber',
    'runs.filter.browserstack': '☁️ BrowserStack',
    'runs.results': 'Latest run results',
    'runs.currentReport': 'View HTML report',
    'runs.currentReportCucumber': 'Open current HTML report',
    'runs.traceViewer': 'Open Trace Viewer',
    'runs.history.executions': 'Run history',
    'runs.history.reports': 'Report history',
    'runs.metric.tests': '🧪 Tests',
    'runs.metric.passed': '🟢 Passed',
    'runs.metric.failed': '🔴 Failed',
    'runs.metric.skipped': '⚪ Skipped',
    'runs.metric.scenarios': '📋 Scenarios',
    'runs.metric.success': '🟢 Passed',
    'runs.metric.failedScenarios': '🔴 Failed',
    'runs.metric.skippedScenarios': '⚪ Skipped',
    'runs.searchPlaywright': 'Search run...',
    'runs.searchCucumber': 'Search report...',
    'runs.status.all': 'All states',
    'runs.status.failed': 'With failures',
    'runs.status.passed': 'Without failures',
    'runs.latestExecution': 'Latest run',
    'runs.latestReport': 'Latest report',
    'runs.current': 'Current',
    'runs.justNow': 'Just now',
    'runs.minuteAgo': '1 minute ago',
    'runs.minutesAgo': '{n} minutes ago',
    'runs.hourAgo': '1 hour ago',
    'runs.hoursAgo': '{n} hours ago',
    'runs.dayAgo': '1 day ago',
    'runs.daysAgo': '{n} days ago',
    'runs.previousReports': 'Previous reports',
    'runs.previousHint': 'The current run shown above is excluded.',
    'runs.playwright.errors': 'Technical errors from the last run',
    'runs.playwright.errorsEmpty': 'The last Playwright run recorded no errors.',
    'runs.cucumber.title': 'Cucumber BDD & Gherkin metrics',
    'runs.cucumber.subtitle': 'Results and natural-language steps.',
    'runs.cucumber.loading': 'Loading BDD metrics…',
    'runs.cucumber.errors': 'Failed scenarios',
    'runs.cucumber.errorsEmpty': 'The last Cucumber run recorded no failed scenarios.',
    'runs.cucumber.noMetrics': 'No BDD metrics recorded yet.',
    'runs.cucumber.showing': 'Showing the first {n} of {total} scenarios.',
    'runs.history.playwright': 'Playwright history',
    'runs.history.cucumber': 'Cucumber history',
    'runs.empty.playwright': 'No Playwright runs.',
    'runs.empty.cucumber': 'No Cucumber reports.',
    'runs.browserstack.title': 'BrowserStack',
    'runs.browserstack.soon': 'BrowserStack integration is under development. Soon you will be able to view cloud test results across multiple browsers and real devices here.',
    'error.location': 'Error location',
    'error.affected': 'Affected URL',
    'error.origin': 'Origin',
    'error.feature': 'Feature',
    'error.failedStep': 'Failed step',
    'error.selector': 'Affected selector',
    'error.diagnosis': 'Error code (technical diagnosis)',
    'error.solution': 'Solution glossary (recommendation)',
    'error.attachments': 'Evidence',
    'error.viewVideo': 'View replay',
    'error.viewContext': 'View error context',
    'error.viewAttachment': 'View attachment',
    'error.copy': 'Copy link path',
    'error.copied': 'Path copied',
    'error.technical': 'View full technical log',
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

function fmtDateShort(ms) {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString(state.lang === 'en' ? 'en-US' : 'es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch { return '—'; }
}

function relativeTime(ms) {
  if (!ms) return '';
  const diff = Date.now() - Number(ms);
  if (!Number.isFinite(diff) || diff < 0) return '';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('runs.justNow');
  if (minutes === 1) return t('runs.minuteAgo');
  if (minutes < 60) return t('runs.minutesAgo', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return t('runs.hourAgo');
  if (hours < 24) return t('runs.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('runs.dayAgo');
  return t('runs.daysAgo', { n: days });
}

function num(n) {
  if (n == null || n === '') return '—';
  const value = Number(n);
  if (!Number.isFinite(value)) return String(n);
  return new Intl.NumberFormat(state.lang === 'en' ? 'en-US' : 'es-CL').format(value);
}

function fmtDuration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value < 1000) return Math.round(value) + ' ms';
  const seconds = value / 1000;
  if (seconds < 60) return seconds.toFixed(1) + ' s';
  const minutes = Math.floor(seconds / 60);
  return minutes + 'm ' + Math.round(seconds % 60) + 's';
}

function shortPath(value) {
  try {
    const parsed = new URL(value);
    return (parsed.pathname || '/') + (parsed.search || '');
  } catch {
    return value || '—';
  }
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

function statusText(status) {
  if (status === 'optimal') return t('home.health.optimal');
  if (status === 'regular') return t('home.health.regular');
  return t('home.health.critical');
}

function statusClass(status) {
  if (status === 'optimal' || status === 'passed') return 'ok';
  if (status === 'critical' || status === 'failed') return 'fail';
  return 'run';
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
  document.title = t('app.title');
  $$('[data-lang-set]').forEach((b) => b.classList.toggle('active', b.dataset.langSet === state.lang));
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  renderHome();
  renderScans();
  renderTests();
  renderRuns();
}

/* ------------------------------------------------------------------ *
 * Inicio: resumen ejecutivo
 * ------------------------------------------------------------------ */
const DONUT_SEGMENTS = [
  { key: 'success', labelKey: 'home.segment.success', color: 'var(--chart-success)' },
  { key: 'warning', labelKey: 'home.segment.warning', color: 'var(--chart-warning)' },
  { key: 'error', labelKey: 'home.segment.error', color: 'var(--chart-error)' }
];

async function loadOverview() {
  try {
    const res = await fetch('/api/overview');
    state.overview = await res.json();
    state.homeShowAll = false;
    renderHome();
    renderTests();
    renderRuns();
  } catch {
    toast(t('toast.error'), true);
  }
}

function renderHome() {
  const data = state.overview;
  const empty = $('#home-empty');
  const content = $('#home-content');
  if (!empty || !content) return;

  if (!data || !data.available) {
    empty.hidden = false;
    content.hidden = true;
    return;
  }

  empty.hidden = true;
  content.hidden = false;

  const health = data.health || { percent: 0, status: 'critical' };
  const badge = $('#home-health-badge');
  badge.textContent = statusText(health.status);
  badge.className = 'badge status ' + statusClass(health.status);
  $('#home-health-percent').textContent = (Number(health.percent) || 0).toFixed(1) + '%';
  $('#home-health-label').textContent = statusText(health.status);

  const source = data.source || {};
  const sourceLabel = source.type === 'playwright'
    ? t('home.source.playwright')
    : source.type === 'cucumber'
      ? t('home.source.cucumber')
      : t('home.source.scan');
  $('#home-url').textContent = source.url || '—';
  $('#home-last-run').textContent = t('home.lastRun', { date: fmtDate(source.timestamp), engine: sourceLabel });

  const reportLink = $('#home-report-link');
  if (source.reportPath) {
    reportLink.href = source.reportPath;
    reportLink.hidden = false;
  } else {
    reportLink.hidden = true;
    reportLink.removeAttribute('href');
  }

  const counts = data.counts || {};
  $('#kpi-pages').textContent = counts.pages != null ? num(counts.pages) : '—';
  $('#kpi-elements').textContent = num(counts.elements || counts.total || 0);
  $('#kpi-success').textContent = num(counts.successes || 0);
  $('#kpi-errors').textContent = num(counts.errors || 0);
  $('#kpi-warnings').textContent = num(counts.warnings || 0);

  renderDonut(data);
  renderHomeErrors();
}

function renderDonut(data) {
  const counts = data.counts || {};
  const values = {
    success: Number(counts.successes) || 0,
    warning: Number(counts.warnings) || 0,
    error: Number(counts.errors) || 0
  };
  const total = Number(counts.total) || 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const arcs = DONUT_SEGMENTS.map((segment) => {
    const value = values[segment.key];
    const length = total ? (value / total) * circumference : 0;
    const arc = `<circle class="donut-segment ${segment.key}" data-segment="${segment.key}" cx="70" cy="70" r="${radius}" fill="none" stroke="${segment.color}" stroke-width="18" stroke-linecap="butt" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)" tabindex="0" role="button" aria-label="${esc(t(segment.labelKey))}: ${num(value)}"><title>${esc(t(segment.labelKey))}: ${num(value)}</title></circle>`;
    offset += length;
    return arc;
  }).join('');

  $('#home-donut').innerHTML = `
    <svg viewBox="0 0 140 140" class="donut-svg" role="img">
      <circle cx="70" cy="70" r="${radius}" fill="none" stroke="var(--surface-2)" stroke-width="18"></circle>
      ${arcs}
    </svg>
    <div class="donut-center">
      <strong id="donut-center-value">${(Number(data.health.percent) || 0).toFixed(1)}%</strong>
      <span id="donut-center-label">${esc(statusText(data.health.status))}</span>
    </div>`;

  $('#home-legend').innerHTML = DONUT_SEGMENTS.map((segment) => `
    <button type="button" data-segment="${segment.key}">
      <span class="dot" style="background:${segment.color}"></span>
      <span>${esc(t(segment.labelKey))}</span>
      <strong>${num(values[segment.key])}</strong>
    </button>`).join('');

  highlightDonut(null);
}

function highlightDonut(key) {
  const data = state.overview;
  if (!data) return;
  const counts = data.counts || {};
  const values = { success: counts.successes || 0, warning: counts.warnings || 0, error: counts.errors || 0 };
  const labels = {
    success: t('home.segment.success'),
    warning: t('home.segment.warning'),
    error: t('home.segment.error')
  };

  $$('#home-donut .donut-segment').forEach((el) => el.classList.toggle('active', el.dataset.segment === key));
  $$('#home-legend [data-segment]').forEach((el) => el.classList.toggle('active', el.dataset.segment === key));

  const centerValue = $('#donut-center-value');
  const centerLabel = $('#donut-center-label');
  if (!centerValue) return;
  if (key) {
    centerValue.textContent = num(values[key] || 0);
    centerLabel.textContent = labels[key];
  } else {
    centerValue.textContent = (Number(data.health.percent) || 0).toFixed(1) + '%';
    centerLabel.textContent = statusText(data.health.status);
  }
}

function selectHomeSegment(key) {
  state.homeSegment = key;
  if (key === 'error') state.homeShowAll = true;
  highlightDonut(key);
  renderHomeErrors();
  if (key === 'error') {
    const list = $('#home-errors-list');
    if (list) list.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function renderHomeErrors() {
  const container = $('#home-errors-list');
  const empty = $('#home-errors-empty');
  const countEl = $('#home-errors-count');
  if (!container) return;

  const data = state.overview;
  const all = data && Array.isArray(data.errorsList) ? data.errorsList : [];
  const segment = state.homeSegment || 'error';
  const list = segment === 'error' ? all : [];
  const limit = state.homeShowAll ? list.length : Math.min(5, list.length);
  const visible = list.slice(0, limit);

  countEl.textContent = num(list.length);
  container.innerHTML = visible.map(errorCardHtml).join('');
  if (list.length > visible.length) {
    container.innerHTML += `<button type="button" class="btn" id="home-show-all">${t('home.errors.showAll', { n: num(list.length) })}</button>`;
  }
  if (empty) {
    empty.hidden = list.length > 0;
    empty.textContent = segment === 'error' ? t('home.errors.empty') : t('home.errors.segmentEmpty');
  }
}

/* ------------------------------------------------------------------ *
 * Tarjetas de error (acordeón)
 * ------------------------------------------------------------------ */
function errorCardHtml(error) {
  const attachments = (error.attachments || []).map((attachment) => {
    const type = String(attachment.type || '');
    if (type.startsWith('image/')) {
      const alt = 'Evidencia del error: ' + (error.title || '') + ' — ' + (error.summary || '');
      return `<a class="attachment" href="${esc(attachment.path)}" target="_blank" rel="noopener"><img class="error-shot" src="${esc(attachment.path)}" alt="${esc(alt)}" loading="lazy"></a>`;
    }
    const label = attachment.name === 'video'
      ? t('error.viewVideo')
      : attachment.name === 'error-context'
        ? t('error.viewContext')
        : (attachment.name || t('error.viewAttachment'));
    return `<a class="attachment" href="${esc(attachment.path)}" target="_blank" rel="noopener">${esc(label)}</a>`;
  }).join('');

  const log = error.technicalLog
    ? `<details class="tech-log"><summary>${t('error.technical')}</summary><pre class="output">${esc(error.technicalLog)}</pre></details>`
    : '';

  const originPath = shortPath(error.origin);
  const sourceText = error.file ? `${error.file}${error.line ? ':' + error.line : ''}` : '';
  const summaryText = [sourceText, error.feature || '', error.summary || '', originPath !== '—' ? originPath : '']
    .filter(Boolean)
    .join(' › ');

  return `
    <article class="error-card">
      <details class="error-details">
        <summary class="error-summary">
          <span class="error-dot"></span>
          <span class="error-code">[${esc(error.code || 'ERR')}]</span>
          <span class="error-title">${esc(error.title || 'Error')}</span>
          <span class="error-summary-text">${esc(summaryText)}</span>
        </summary>
        <div class="error-body">
          <section>
            <h4>🌐 ${t('error.location')}</h4>
            <p><strong>${t('error.affected')}:</strong> <code>${esc(error.url || '—')}</code></p>
            <p><strong>${t('error.origin')}:</strong> <code>${esc(error.origin || '—')}</code></p>
            ${error.feature ? `<p><strong>${t('error.feature')}:</strong> ${esc(error.feature)}</p>` : ''}
            ${error.step ? `<p><strong>${t('error.failedStep')}:</strong> <code>${esc(error.stepKeyword)} ${esc(error.step)}</code></p>` : ''}
            ${error.selector ? `<p><strong>${t('error.selector')}:</strong> <code>${esc(error.selector)}</code></p>` : ''}
          </section>
          <section>
            <h4>⚠️ ${t('error.diagnosis')}</h4>
            <p>${esc(error.diagnosis || '')}</p>
          </section>
          <section>
            <h4>💡 ${t('error.solution')}</h4>
            <p>${esc(error.recommendation || '')}</p>
          </section>
          ${attachments ? `<section><h4>📎 ${t('error.attachments')}</h4>${attachments}</section>` : ''}
          <div class="error-actions">
            <button type="button" class="btn" data-copy="${esc(error.url || '')}">${t('error.copy')}</button>
          </div>
          ${log}
        </div>
      </details>
    </article>`;
}

function renderErrorCards(errors, container, empty, countEl, limit) {
  if (!container) return;
  const list = Array.isArray(errors) ? errors : [];
  const visible = limit ? list.slice(0, limit) : list;
  container.innerHTML = visible.map(errorCardHtml).join('');
  if (list.length > visible.length) {
    container.innerHTML += `<button type="button" class="btn" data-error-detail>${t('home.errors.showAll', { n: num(list.length) })}</button>`;
  }
  if (empty) empty.hidden = list.length > 0;
  if (countEl) countEl.textContent = num(list.length);
}

function openOverviewDetail() {
  const data = state.overview;
  const errors = data && Array.isArray(data.errorsList) ? data.errorsList : [];
  const body = errors.length
    ? `<div class="error-list">${errors.map(errorCardHtml).join('')}</div>`
    : `<p class="empty">${t('home.errors.empty')}</p>`;
  openModal(t('home.detailTitle'), body, true);
}

/* ------------------------------------------------------------------ *
 * Escaneos
 * ------------------------------------------------------------------ */
async function loadScans() {
  try {
    const res = await fetch('/api/scans');
    const json = await res.json();
    state.scans = json.scans || [];

    // Si la categoría activa quedó vacía, abrir la del escaneo más reciente.
    if (state.scans.length > 0) {
      const currentCount = state.scans.filter((scan) => (scan.scanType || 'custom') === state.scanFilter).length;
      if (currentCount === 0) state.scanFilter = state.scans[0].scanType || 'custom';
    }

    renderScans();
  } catch {
    toast(t('toast.error'), true);
  }
}

function kindLabel(kind) {
  if (kind === 'crawl') return t('scans.kind.crawl');
  if (kind === 'framework') return t('scans.kind.framework');
  return t('scans.kind.unknown');
}

function scanTypeLabel(type) {
  if (type === 'quick') return t('scans.filter.quick');
  if (type === 'full') return t('scans.filter.full');
  return t('scans.filter.custom');
}

function renderScans() {
  const list = $('#scans-list');
  const empty = $('#scans-empty');
  if (!list) return;

  const scans = state.scans || [];
  $('#scans-count').textContent = num(scans.length);

  for (const type of ['quick', 'full', 'custom']) {
    const count = scans.filter((scan) => (scan.scanType || 'custom') === type).length;
    $$(`[data-scan-count="${type}"]`).forEach((el) => { el.textContent = num(count); });
  }

  $$('[data-scan-filter]').forEach((button) => {
    button.classList.toggle('active', button.dataset.scanFilter === state.scanFilter);
  });

  const filtered = scans.filter((scan) => (scan.scanType || 'custom') === state.scanFilter);
  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    empty.textContent = t('scans.empty');
    return;
  }
  empty.hidden = true;

  list.innerHTML = filtered.map((scan) => {
    const meta = [];
    meta.push(`<span class="badge">${esc(scanTypeLabel(scan.scanType))}</span>`);
    meta.push(`<span class="badge">${esc(kindLabel(scan.kind))}</span>`);
    if (scan.pages != null) meta.push(`<span class="badge">${t('scans.pages')}: ${esc(scan.pages)}</span>`);
    if (scan.links != null) meta.push(`<span class="badge">${t('scans.links')}: ${esc(scan.links)}</span>`);
    if (scan.tests != null) meta.push(`<span class="badge">${t('scans.tests')}: ${esc(scan.tests)}</span>`);
    if (scan.errors != null && scan.errors > 0) meta.push(`<span class="badge fail">${t('scans.errors')}: ${esc(scan.errors)}</span>`);
    meta.push(`<span class="badge">${esc(fmtBytes(scan.size))}</span>`);
    meta.push(`<span class="badge">${esc(fmtDate(scan.mtime))}</span>`);

    return `
      <article class="scan">
        <div class="scan-top">
          <div>
            <h3 class="scan-name">${esc(scan.name)}</h3>
            <div class="scan-url">${esc(scan.url || '—')}</div>
          </div>
          <div class="scan-actions">
            <button type="button" class="btn" data-view="${esc(scan.file)}">${t('common.view')}</button>
            <button type="button" class="btn danger" data-delete="${esc(scan.file)}">${t('common.delete')}</button>
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
    rows.push('<table><thead><tr><th>URL</th><th>Texto / Título</th></tr></thead><tbody>');
    for (const item of slice) {
      rows.push(`<tr><td class="mono">${esc(item.url || item.href || '')}</td><td>${esc(item.text || item.title || '')}</td></tr>`);
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
    ? '<div class="scan-meta" style="margin-bottom:14px">' +
      summary.map(([key, value]) => `<span class="badge">${esc(key)}: ${esc(value)}</span>`).join('') + '</div>'
    : '';

  openModal(file, summaryHtml + table);
}

async function deleteScan(file) {
  const scan = state.scans.find((item) => item.file === file);
  const message = t('scans.deleteConfirm', { name: scan ? scan.name : file });
  const ok = await confirmAction(message);
  if (!ok) return;
  try {
    const res = await fetch('/api/scan?file=' + encodeURIComponent(file), { method: 'DELETE' });
    const json = await res.json();
    if (json.error) { toast(json.error, true); return; }
    toast(t('toast.deleted'));
    loadScans();
    loadOverview();
  } catch {
    toast(t('toast.error'), true);
  }
}

/* ------------------------------------------------------------------ *
 * Tests y reportes
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
  const tests = state.tests;
  const spec = tests ? tests.spec : null;
  const bddMetrics = tests ? tests.bddMetrics : null;
  const cucumber = tests ? tests.cucumber : null;

  const specPath = $('#tests-spec-path');
  if (specPath) specPath.textContent = spec && spec.exists ? spec.path : '';

  const testsEmpty = $('#tests-empty');
  if (testsEmpty) testsEmpty.hidden = Boolean(spec && spec.exists);

  const cases = $('#tests-cases');
  if (cases) {
    const specTests = spec && Array.isArray(spec.tests) ? spec.tests : [];
    const limit = 20;
    cases.innerHTML = specTests.slice(0, limit).map((name) => `<li>${esc(name)}</li>`).join('');
    if (specTests.length > limit) {
      cases.innerHTML += `<li class="muted">${esc(t('tests.showing', { n: limit, total: specTests.length }))}</li>`;
    }
  }

  const runButton = $('#run-tests');
  if (runButton) runButton.disabled = !spec || !spec.exists || !spec.hasConfig;

  const bddSummary = $('#bdd-metrics-summary');
  if (bddSummary) {
    if (bddMetrics) {
      const scenariosPassed = Number(bddMetrics.scenariosPassed ?? bddMetrics.passed ?? 0);
      const scenariosFailed = Number(bddMetrics.scenariosFailed ?? bddMetrics.failed ?? 0);
      const stepsPassed = Number(bddMetrics.passed || 0);
      bddSummary.innerHTML = `
        <strong>Features:</strong> ${esc(bddMetrics.totalFeatures || 0)} |
        <strong>Escenarios:</strong> ${esc(bddMetrics.totalScenarios || 0)} |
        <strong>Pasos:</strong> ${esc(bddMetrics.totalSteps || 0)} |
        <span class="badge ok">Escenarios OK: ${esc(scenariosPassed)}</span>
        <span class="badge fail">Escenarios fallidos: ${esc(scenariosFailed)}</span>
        <span class="badge">Pasos OK: ${esc(stepsPassed)}</span>`;
    } else {
      bddSummary.textContent = t('runs.cucumber.noMetrics');
    }
  }

  const bddFeatures = $('#cucumber-features');
  if (bddFeatures) {
    if (cucumber && Array.isArray(cucumber.features) && cucumber.features.length > 0) {
      const totalScenarios = cucumber.features.reduce((sum, feature) => sum + (feature.scenarios || []).length, 0);
      const scenarioLimit = 30;
      let renderedScenarios = 0;
      let featuresHtml = cucumber.features.map((feature) => {
        const allScenarios = feature.scenarios || [];
        const scenarios = allScenarios.slice(0, Math.max(0, scenarioLimit - renderedScenarios));
        renderedScenarios += scenarios.length;
        if (scenarios.length === 0) return '';
        return `
          <div class="cucumber-feature">
            <h4>${esc(feature.name)}</h4>
            ${scenarios.map((scenario) => `
              <div class="cucumber-scenario">
                <div class="cucumber-scenario-title">
                  <span class="badge ${statusClass(scenario.status)}">${esc(scenario.status)}</span>
                  <strong>${esc(scenario.name)}</strong>
                </div>
                <ul class="cases">
                  ${(scenario.steps || []).map((step) => `
                    <li>
                      <span class="badge ${statusClass(step.status)}">${esc(step.status)}</span>
                      <strong>${esc(step.keyword)}</strong> ${esc(step.name)}
                    </li>`).join('')}
                </ul>
              </div>`).join('')}
          </div>`;
      }).join('');
      if (totalScenarios > renderedScenarios) {
        featuresHtml += `<p class="muted">${esc(t('runs.cucumber.showing', { n: renderedScenarios, total: totalScenarios }))}</p>`;
      }
      bddFeatures.innerHTML = featuresHtml;
    } else {
      bddFeatures.innerHTML = `<p class="muted">${t('tests.noSpec')}</p>`;
    }
  }

  const overview = state.overview;
  const playwright = overview && overview.playwright;
  const playwrightAvailable = Boolean(playwright && playwright.available);
  const setMetric = (selector, value, available) => {
    const el = $(selector);
    if (el) el.textContent = available ? num(value) : '—';
  };

  setMetric('#playwright-metric-total', playwright && playwright.total, playwrightAvailable);
  setMetric('#playwright-metric-passed', playwright && playwright.successes, playwrightAvailable);
  setMetric('#playwright-metric-failed', playwright && playwright.errors, playwrightAvailable);
  setMetric('#playwright-metric-skipped', playwright && playwright.skipped, playwrightAvailable);

  const playwrightDate = $('#playwright-date-badge');
  if (playwrightDate) {
    playwrightDate.textContent = playwrightAvailable
      ? [relativeTime(playwright.timestamp), fmtDateShort(playwright.timestamp)].filter(Boolean).join(' · ')
      : '';
  }

  const playwrightTrace = $('#playwright-trace-btn');
  if (playwrightTrace) {
    if (playwrightAvailable && playwright.reportPath) {
      playwrightTrace.hidden = false;
      playwrightTrace.dataset.runPreview = playwright.reportPath;
    } else {
      playwrightTrace.hidden = true;
      delete playwrightTrace.dataset.runPreview;
    }
  }

  const playwrightReport = $('#playwright-current-report');
  if (playwrightReport) {
    if (playwrightAvailable && playwright.reportPath) {
      playwrightReport.href = playwright.reportPath;
      playwrightReport.hidden = false;
    } else {
      playwrightReport.hidden = true;
      playwrightReport.removeAttribute('href');
    }
  }

  renderErrorCards(
    playwrightAvailable ? playwright.errorsList : [],
    $('#playwright-errors'),
    $('#playwright-errors-empty'),
    $('#playwright-errors-count'),
    10
  );

  const cucumberExecution = overview && overview.cucumber;
  const cucumberAvailable = Boolean(cucumberExecution && cucumberExecution.available);
  setMetric('#cucumber-metric-total', cucumberExecution && cucumberExecution.total, cucumberAvailable);
  setMetric('#cucumber-metric-passed', cucumberExecution && cucumberExecution.successes, cucumberAvailable);
  setMetric('#cucumber-metric-failed', cucumberExecution && cucumberExecution.errors, cucumberAvailable);
  setMetric('#cucumber-metric-skipped', cucumberExecution && cucumberExecution.skipped, cucumberAvailable);

  const cucumberDate = $('#cucumber-date-badge');
  if (cucumberDate) {
    cucumberDate.textContent = cucumberAvailable
      ? [relativeTime(cucumberExecution.timestamp), fmtDateShort(cucumberExecution.timestamp)].filter(Boolean).join(' · ')
      : '';
  }

  const cucumberReport = $('#cucumber-current-report');
  if (cucumberReport) {
    if (cucumberAvailable && cucumberExecution.reportPath) {
      cucumberReport.href = cucumberExecution.reportPath;
      cucumberReport.hidden = false;
    } else {
      cucumberReport.hidden = true;
      cucumberReport.removeAttribute('href');
    }
  }

  renderErrorCards(
    cucumberExecution && cucumberExecution.available ? cucumberExecution.errorsList : [],
    $('#cucumber-errors'),
    $('#cucumber-errors-empty'),
    $('#cucumber-errors-count'),
    10
  );
}

async function runTests() {
  const button = $('#run-tests');
  const card = $('#tests-output-card');
  const output = $('#tests-output');
  const status = $('#tests-status');

  button.disabled = true;
  button.textContent = t('tests.running');
  card.hidden = false;
  output.textContent = '';
  status.className = 'badge run';
  status.textContent = t('tests.status.running');

  try {
    const res = await fetch('/api/tests/run', { method: 'POST' });
    const json = await res.json();
    pollJob(json.id);
  } catch {
    toast(t('toast.error'), true);
    button.disabled = false;
    button.textContent = t('tests.run');
  }
}

function pollJob(id) {
  clearInterval(state.jobTimer);
  state.jobTimer = setInterval(async () => {
    try {
      const res = await fetch('/api/tests/run/' + encodeURIComponent(id));
      const job = await res.json();
      const output = $('#tests-output');
      output.textContent = job.output || '';
      output.scrollTop = output.scrollHeight;

      const status = $('#tests-status');
      if (job.status === 'running') {
        status.className = 'badge run';
        status.textContent = t('tests.status.running');
      } else {
        clearInterval(state.jobTimer);
        status.className = 'badge ' + (job.status === 'done' ? 'ok' : 'fail');
        status.textContent = t('tests.status.' + job.status);
        const button = $('#run-tests');
        button.disabled = false;
        button.textContent = t('tests.run');
        loadTests();
        loadOverview();
        loadRuns();
      }
    } catch {
      clearInterval(state.jobTimer);
    }
  }, 1200);
}

/* ------------------------------------------------------------------ *
 * Ejecuciones
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
  const runs = state.runs || [];
  const count = $('#runs-count');
  if (count) count.textContent = num(runs.length);

  $$('[data-run-filter]').forEach((button) => {
    button.classList.toggle('active', button.dataset.runFilter === state.runFilter);
  });
  $$('.run-subpanel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === 'run-panel-' + state.runFilter);
  });

  const overview = state.overview || {};
  const playwrightExecution = overview.playwright && overview.playwright.available ? overview.playwright : null;
  const cucumberExecution = overview.cucumber && overview.cucumber.available ? overview.cucumber : null;
  const currentPlaywright = playwrightExecution ? playwrightExecution.reportPath : null;
  const currentCucumber = cucumberExecution ? cucumberExecution.reportPath : null;

  const playwrightRuns = withCurrentStats(
    runs.filter((run) => run.type === 'playwright'),
    currentPlaywright,
    playwrightExecution
  );
  const cucumberRuns = withCurrentStats(
    runs.filter((run) => run.type === 'cucumber'),
    currentCucumber,
    cucumberExecution
  );

  renderHistoryList(
    playwrightRuns,
    currentPlaywright,
    '#runs-list-playwright',
    '#runs-empty-playwright',
    '#playwright-runs-count',
    'playwright'
  );
  renderHistoryList(
    cucumberRuns,
    currentCucumber,
    '#runs-list-cucumber',
    '#runs-empty-cucumber',
    '#cucumber-runs-count',
    'cucumber'
  );
}

function withCurrentStats(runs, currentPath, execution) {
  if (!currentPath || !execution) return runs;
  return runs.map((run) => {
    if (run.reportPath !== currentPath) return run;
    return {
      ...run,
      tests: execution.total,
      passed: execution.successes,
      failed: execution.errors,
      skipped: execution.skipped
    };
  });
}

function renderHistoryList(runs, currentPath, listSelector, emptySelector, countSelector, kind) {
  const list = $(listSelector);
  if (!list) return;

  const search = String(state.runSearch[kind] || '').trim().toLowerCase();
  const status = kind === 'playwright' ? state.runStatus.playwright : 'all';
  const filtered = runs.filter((run) => {
    if (search) {
      const haystack = `${run.id} ${run.url || ''} ${fmtDateShort(run.mtime)} ${run.passed ?? ''} ${run.failed ?? ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (status === 'failed' && !(Number(run.failed) > 0)) return false;
    if (status === 'passed' && !(run.failed === 0 && run.passed != null)) return false;
    return true;
  });

  const countEl = $(countSelector);
  if (countEl) countEl.textContent = num(filtered.length);

  if (filtered.length === 0) {
    list.innerHTML = '';
    const empty = $(emptySelector);
    if (empty) empty.hidden = false;
    return;
  }
  const empty = $(emptySelector);
  if (empty) empty.hidden = true;

  list.innerHTML = filtered.map((run) => historyItemHtml(run, currentPath, kind)).join('');
}

function historyItemHtml(run, currentPath, kind) {
  const active = Boolean(currentPath && run.reportPath === currentPath);
  const hasCounts = run.passed != null || run.failed != null;
  const dotClass = active ? 'ok' : 'run';
  const title = active
    ? t(kind === 'playwright' ? 'runs.latestExecution' : 'runs.latestReport')
    : fmtDateShort(run.mtime);
  const counts = hasCounts
    ? `${num(run.passed ?? 0)} OK / ${num(run.failed ?? 0)} Fail`
    : t('runs.noCounts');

  return `
    <button type="button" class="history-item${active ? ' active' : ''}" data-run-preview="${esc(run.reportPath)}">
      <span class="history-dot ${dotClass}" aria-hidden="true"></span>
      <span class="history-main">
        <span class="history-title">${esc(title)}${active ? ` <span class="badge ok">${t('runs.current')}</span>` : ''}</span>
        ${active ? `<span class="history-date">${esc(fmtDateShort(run.mtime))}</span>` : ''}
        <span class="history-meta">${esc(counts)}${run.pages != null ? ` · ${esc(run.pages)} pág.` : ''}</span>
      </span>
    </button>`;
}

function openRunPreview(reportPath) {
  openModal(t('runs.open'), `<iframe class="report-frame" src="${esc(reportPath)}" title="report"></iframe>`, true);
}

/* ------------------------------------------------------------------ *
 * Copiar, modal y confirmación
 * ------------------------------------------------------------------ */
async function copyText(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast(t('error.copied'));
    return;
  } catch { /* fallback */ }

  const area = document.createElement('textarea');
  area.value = text;
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand('copy');
    toast(t('error.copied'));
  } catch {
    toast(t('toast.error'), true);
  }
  area.remove();
}

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
  if (confirmResolver) {
    const resolve = confirmResolver;
    confirmResolver = null;
    resolve(result);
  }
}

/* ------------------------------------------------------------------ *
 * Pestañas y filtros
 * ------------------------------------------------------------------ */
function setTab(name) {
  $$('.tab').forEach((button) => {
    const active = button.dataset.tab === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  $$('.panel').forEach((panel) => panel.classList.toggle('active', panel.id === 'panel-' + name));
  if (name === 'home') loadOverview();
  if (name === 'scans') loadScans();
  if (name === 'runs') {
    loadTests();
    loadRuns();
    loadOverview();
  }
}

function setScanFilter(type) {
  state.scanFilter = type;
  renderScans();
}

function setRunFilter(type) {
  state.runFilter = type;
  renderRuns();
}

/* ------------------------------------------------------------------ *
 * Eventos
 * ------------------------------------------------------------------ */
function bind() {
  $$('[data-theme-set]').forEach((button) => button.addEventListener('click', () => {
    state.theme = button.dataset.themeSet;
    localStorage.setItem('cq.theme', state.theme);
    applyTheme();
  }));

  $$('[data-lang-set]').forEach((button) => button.addEventListener('click', () => {
    state.lang = button.dataset.langSet;
    localStorage.setItem('cq.lang', state.lang);
    applyLang();
  }));

  $$('.tab').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.tab)));
  $$('[data-scan-filter]').forEach((button) => button.addEventListener('click', () => setScanFilter(button.dataset.scanFilter)));
  $$('[data-run-filter]').forEach((button) => button.addEventListener('click', () => setRunFilter(button.dataset.runFilter)));

  $('#refresh').addEventListener('click', async () => {
    await Promise.all([loadOverview(), loadScans(), loadTests(), loadRuns()]);
    toast(t('toast.refreshed'));
  });

  $('#scans-list').addEventListener('click', (event) => {
    const view = event.target.closest('[data-view]');
    const del = event.target.closest('[data-delete]');
    if (view) openScan(view.dataset.view);
    if (del) deleteScan(del.dataset.delete);
  });

  ['#runs-list-playwright', '#runs-list-cucumber'].forEach((selector) => {
    const list = $(selector);
    if (!list) return;
    list.addEventListener('click', (event) => {
      const preview = event.target.closest('[data-run-preview]');
      if (preview) openRunPreview(preview.dataset.runPreview);
    });
  });

  const playwrightSearch = $('#runs-search-playwright');
  if (playwrightSearch) {
    playwrightSearch.addEventListener('input', () => {
      state.runSearch.playwright = playwrightSearch.value;
      renderRuns();
    });
  }

  const cucumberSearch = $('#runs-search-cucumber');
  if (cucumberSearch) {
    cucumberSearch.addEventListener('input', () => {
      state.runSearch.cucumber = cucumberSearch.value;
      renderRuns();
    });
  }

  const playwrightStatus = $('#runs-status-playwright');
  if (playwrightStatus) {
    playwrightStatus.addEventListener('change', () => {
      state.runStatus.playwright = playwrightStatus.value;
      renderRuns();
    });
  }

  const playwrightTrace = $('#playwright-trace-btn');
  if (playwrightTrace) {
    playwrightTrace.addEventListener('click', () => {
      if (playwrightTrace.dataset.runPreview) openRunPreview(playwrightTrace.dataset.runPreview);
    });
  }

  $('#run-tests').addEventListener('click', runTests);
  $('#home-detail-btn').addEventListener('click', openOverviewDetail);

  const donut = $('#home-donut');
  donut.addEventListener('mouseover', (event) => {
    const segment = event.target.closest('[data-segment]');
    if (segment) highlightDonut(segment.dataset.segment);
  });
  donut.addEventListener('mouseleave', () => highlightDonut(null));
  donut.addEventListener('focusin', (event) => {
    const segment = event.target.closest('[data-segment]');
    if (segment) highlightDonut(segment.dataset.segment);
  });
  donut.addEventListener('focusout', () => highlightDonut(null));
  donut.addEventListener('click', (event) => {
    const segment = event.target.closest('[data-segment]');
    if (segment) selectHomeSegment(segment.dataset.segment);
  });
  donut.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const segment = event.target.closest('[data-segment]');
    if (!segment) return;
    event.preventDefault();
    selectHomeSegment(segment.dataset.segment);
  });

  const legend = $('#home-legend');
  legend.addEventListener('mouseover', (event) => {
    const segment = event.target.closest('[data-segment]');
    if (segment) highlightDonut(segment.dataset.segment);
  });
  legend.addEventListener('mouseleave', () => highlightDonut(null));
  legend.addEventListener('click', (event) => {
    const segment = event.target.closest('[data-segment]');
    if (segment) selectHomeSegment(segment.dataset.segment);
  });

  document.addEventListener('click', (event) => {
    const copy = event.target.closest('[data-copy]');
    if (copy) copyText(copy.dataset.copy);
    if (event.target.closest('#home-show-all')) {
      state.homeShowAll = true;
      renderHomeErrors();
    }
    if (event.target.closest('[data-error-detail]')) openOverviewDetail();
  });

  $('#modal-close').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', (event) => { if (event.target.id === 'modal') closeModal(); });
  $('#confirm-ok').addEventListener('click', () => closeConfirm(true));
  $('#confirm-cancel').addEventListener('click', () => closeConfirm(false));
  $('#confirm').addEventListener('click', (event) => { if (event.target.id === 'confirm') closeConfirm(false); });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
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
  setScanFilter(state.scanFilter);
  setRunFilter(state.runFilter);
  Promise.all([loadOverview(), loadScans(), loadTests(), loadRuns()]);
}

init();
