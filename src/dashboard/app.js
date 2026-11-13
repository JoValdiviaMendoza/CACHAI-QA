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
  expandedRunGroups: { playwright: {}, cucumber: {} },
  activeRunGroup: { playwright: null, cucumber: null },
  homeSegment: 'error',
  homeShowAll: false,
  aboutTab: 'how',
  scanFavorites: [],
  scanJob: null,
  browserstack: null,
  selectedRun: { playwright: null, cucumber: null },
  runDetail: { playwright: null, cucumber: null },
  runDetailLoading: { playwright: false, cucumber: false },
  ci: {
    config: null,
    runs: [],
    scan: null,
    errors: [],
    errorReportLoading: false,
    loading: false,
    importing: false,
    dispatching: false,
    error: '',
    autoImporting: false
  }
};

try {
  const savedFavorites = JSON.parse(localStorage.getItem('cq.scanFavorites') || '[]');
  if (Array.isArray(savedFavorites)) state.scanFavorites = savedFavorites.filter((item) => typeof item === 'string');
} catch { /* preferencias inválidas: se ignoran */ }

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
    'tabs.ci': 'GitHub Actions',
    'tabs.about': '¿Qué es CACHAI-QA?',
    'ci.title': 'GitHub Actions',
    'ci.warning': 'Esta sección requiere conocimientos de Git, GitHub Actions y tokens de acceso. Úsala con cuidado: una ejecución full puede tardar y consumir recursos. GitHub Actions no puede acceder a localhost: usa una URL pública o un túnel.',
    'ci.refresh': 'Actualizar',
    'ci.import': 'Importar última',
    'ci.importing': 'Importando…',
    'ci.config.title': 'Configuración pendiente',
    'ci.config.text': 'Para importar ejecuciones automáticamente, configura el repositorio y un token de GitHub con permiso de lectura sobre Actions.',
    'ci.config.help': 'Agrega estas variables a src/.env y reinicia el dashboard.',
    'ci.runs.title': 'Ejecuciones recientes',
    'ci.scan.title': 'Scan importado',
    'ci.scan.empty': 'Todavía no hay un scan importado.',
    'ci.scan.pages': 'Páginas',
    'ci.scan.onePage': '1 página',
    'ci.scan.pagesCount': '{n} páginas',
    'ci.scan.links': 'Enlaces',
    'ci.scan.type': 'Tipo',
    'ci.scan.depth': 'Profundidad',
    'ci.scan.date': 'Fecha',
    'ci.scan.downloads': 'Descargas omitidas',
    'ci.scan.invalid': 'Enlaces inválidos',
    'ci.scan.view': 'Ver escaneo',
    'ci.errors.title': 'Errores del reporte importado',
    'ci.errors.empty': 'El reporte importado no registró errores.',
    'ci.imported.title': 'Reportes importados',
    'ci.imported.empty': 'Todavía no hay reportes de GitHub importados.',
    'ci.imported.viewReport': 'Ver reporte',
    'ci.imported.viewScan': 'Ver scan',
    'ci.imported.detail': 'Ver detalle',
    'ci.imported.delete': 'Eliminar reporte',
    'ci.imported.deleted': 'Reporte importado eliminado.',
    'ci.help': 'Importa una ejecución para que sus escaneos y reportes aparezcan en Inicio, Escaneos y Ejecuciones.',
    'ci.empty': 'No hay ejecuciones recientes.',
    'ci.last.title': 'Última importación',
    'ci.last.none': 'Todavía no has importado ninguna ejecución.',
    'ci.last.text': 'Ejecución #{id} · {date}',
    'ci.status.success': 'Exitosa',
    'ci.status.failure': 'Fallida',
    'ci.status.cancelled': 'Cancelada',
    'ci.status.inProgress': 'En curso',
    'ci.status.queued': 'En cola',
    'ci.import.run': 'Importar',
    'ci.imported': 'Importada',
    'ci.import.ok': 'Ejecución importada. Actualizando el panel…',
    'ci.import.error': 'No se pudo importar la ejecución.',
    'ci.run.placeholder': 'https://ejemplo.com',
    'ci.run.start': 'Ejecutar en GitHub Actions',
    'ci.run.dispatching': 'Enviando ejecución…',
    'ci.run.sent': 'Ejecución enviada. Esperando a que aparezca en GitHub…',
    'ci.run.waiting': 'Esperando ejecución en GitHub Actions…',
    'ci.run.error': 'No se pudo iniciar la ejecución en GitHub Actions.',
    'ci.run.done': 'Ejecución remota completada.',
    'ci.run.config': 'Configuración del workflow',
    'ci.run.config.help': 'Estos valores se envían al workflow; no modifican el archivo YAML.',
    'ci.run.scanType': 'Elementos',
    'ci.run.depth': 'Profundidad',
    'ci.run.maxPages': 'Máx. páginas',
    'ci.run.engine': 'Motor',
    'ci.run.browsers': 'Navegadores',
    'ci.run.maxLinks': 'Enlaces por página',
    'ci.auto': 'Importación automática activa',
    'ci.manual': 'Importación manual',
    'ci.open': 'Abrir en GitHub',
    'ci.branch': 'Rama',
    'ci.noConfig': 'Falta configuración de GitHub Actions.',
    'about.title': '¿Qué hace CACHAI-QA?',
    'about.tab.how': 'Cómo funciona',
    'about.tab.glossary': 'Glosario',
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
    'home.errors.unique': 'defectos únicos',
    'home.segment.success': 'Éxitos',
    'home.segment.warning': 'Advertencias',
    'home.segment.error': 'Errores',
    'home.source.playwright': 'Playwright',
    'home.source.cucumber': 'Cucumber',
    'home.source.scan': 'Escaneo',
    'scans.title': 'Escaneos guardados',
    'scans.empty': 'No hay escaneos en esta categoría.',
    'scans.create.title': 'Nueva auditoría local completa',
    'scans.create.help': 'Ingresa una URL. Se ejecuta crawler, generación, Playwright, Cucumber y reportes.',
    'scans.create.provider': 'Entorno',
    'scans.create.provider.local': 'Local',
    'scans.create.provider.browserstack': 'BrowserStack (nube)',
    'scans.create.provider.hint': 'BrowserStack ejecuta Playwright en la nube; Cucumber sigue local.',
    'scans.create.provider.missing': 'Agrega las credenciales en src/.env para habilitar BrowserStack.',
    'scans.create.placeholder': 'https://ejemplo.com',
    'scans.create.start': 'Ejecutar auditoría',
    'scans.create.cancel': 'Cancelar',
    'scans.create.mode': 'Tipo de escaneo',
    'scans.create.type': 'Elementos',
    'scans.create.type.all': 'Todos',
    'scans.create.type.links': 'Enlaces',
    'scans.create.type.images': 'Imágenes',
    'scans.create.type.forms': 'Formularios',
    'scans.create.type.buttons': 'Botones',
    'scans.create.depth': 'Profundidad',
    'scans.create.maxPages': 'Máx. páginas',
    'scans.create.running': 'Auditoría en curso…',
    'scans.create.doneBadge': 'Completada',
    'scans.create.failedBadge': 'Error',
    'scans.create.cancelledBadge': 'Cancelada',
    'scans.create.testsFailedBadge': 'Con fallos',
    'scans.create.invalid': 'Ingresa una URL HTTP o HTTPS válida.',
    'scans.create.done': 'Auditoría completada. Actualizando el panel…',
    'scans.create.testsFailed': 'Auditoría completada con fallos de prueba. Revisa Ejecuciones.',
    'scans.create.cancelled': 'Auditoría cancelada.',
    'scans.create.failed': 'La auditoría terminó con errores.',
    'scans.filter.quick': '⚡ Rápido',
    'scans.filter.full': '🌐 Completo',
    'scans.filter.custom': '🎯 Personalizado',
    'scans.filter.automated': '🤖 Automatizados',
    'scans.filter.favorites': '⭐ Guardados',
    'scans.emptyFavorites': 'Todavía no marcaste ningún escaneo como guardado. Usa la estrella de una tarjeta.',
    'scans.favorite.add': 'Guardar escaneo',
    'scans.favorite.remove': 'Quitar de guardados',
    'scans.deleteConfirmRuns': '¿Eliminar el escaneo "{name}"? También se eliminarán las ejecuciones asociadas de Playwright y Cucumber. Esta acción no se puede deshacer.',
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
    'scans.group.crawl': 'Escaneos del crawler',
    'scans.group.framework': 'Resúmenes de generación de tests',
    'scans.group.unknown': 'Otros archivos',
    'scans.deleteConfirm': '¿Eliminar el escaneo "{name}"? Esta acción no se puede deshacer.',
    'confirm.title': 'Confirmar eliminación',
    'scans.detail': 'Detalle del escaneo',
    'scans.noLinks': 'Este archivo no contiene enlaces listados.',
    'scans.showing': 'Mostrando los primeros {n} de {total} enlaces.',
    'tests.spec': 'Especificación generada (Playwright)',
    'tests.specCount': '{n} casos',
    'tests.reports': 'Reportes HTML',
    'tests.noSpec': 'No hay tests generados. Ejecuta primero la opción [4].',
    'tests.noReports': 'Todavía no hay reportes.',
    'tests.showing': 'Mostrando los primeros {n} de {total} tests.',
    'tests.open': 'Abrir',
    'runs.title': 'Ejecuciones de tests',
    'runs.empty': 'Todavía no hay ejecuciones de tests.',
    'runs.date': 'Fecha',
    'runs.pages': 'Páginas',
    'runs.pagesShort': 'pág.',
    'runs.tests': 'Tests',
    'runs.open': 'Abrir reporte',
    'runs.preview': 'Ver aquí',
    'runs.noUrl': 'URL no disponible',
    'runs.filter.playwright': '🎭 Playwright',
    'runs.filter.cucumber': '🥒 Cucumber',
    'runs.filter.browserstack': '☁️ BrowserStack',
    'runs.results': 'Resultados de la ejecución',
    'runs.currentReport': 'Ver Reporte HTML',
    'runs.currentReportCucumber': 'Abrir Reporte HTML Actual',
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
    'runs.group.noUrl': 'Sin URL',
    'runs.group.count': '{n} ejecuciones',
    'runs.group.countOne': '1 ejecución',
    'runs.group.countCucumber': '{n} reportes',
    'runs.group.countCucumberOne': '1 reporte',
    'runs.executionNumber': 'Ejecución {n}',
    'runs.reportNumber': 'Reporte {n}',
    'runs.bdd.summary': 'Features: {features} · Escenarios: {scenarios} · Pasos: {steps}',
    'runs.noCounts': 'Sin métricas',
    'runs.latestExecution': 'Última ejecución',
    'runs.latestReport': 'Último reporte',
    'runs.current': 'Actual',
    'runs.selected': 'Viendo {name} · {date}',
    'runs.backToLatest': 'Volver a la última',
    'runs.selectedLoading': 'Cargando resultados de la ejecución…',
    'runs.selectedError': 'No se pudieron cargar los resultados de esta ejecución.',
    'runs.delete': 'Eliminar ejecución',
    'runs.deleteConfirm': '¿Eliminar la ejecución del {date}? Se borrarán su reporte HTML y sus datos asociados.',
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
    'runs.browserstack.configured': 'Credenciales configuradas',
    'runs.browserstack.notConfigured': 'Faltan credenciales',
    'runs.browserstack.hint': 'Para ejecutar en la nube solo agrega BROWSERSTACK_USERNAME y BROWSERSTACK_ACCESS_KEY en src/.env. El proyecto, la build y los navegadores se configuran automáticamente.',
    'runs.browserstack.history': 'Ejecuciones en la nube',
    'runs.browserstack.empty': 'Todavía no hay ejecuciones en BrowserStack.',
    'runs.browserstack.report': 'Ver reporte',
    'runs.browserstack.open': 'Abrir en BrowserStack',
    'runs.browserstack.delete': 'Eliminar ejecución',
    'runs.browserstack.local': 'Túnel local',
    'runs.browserstack.cloud': 'Nube',
    'error.location': 'Dirección del error (ubicación)',
    'error.affected': 'URL afectada',
    'error.browser': 'Navegador',
    'error.occurrences': 'Repeticiones',
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
    'toast.runDeleted': 'Ejecución eliminada',
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
    'tabs.ci': 'GitHub Actions',
    'tabs.about': 'What is CACHAI-QA?',
    'ci.title': 'GitHub Actions',
    'ci.warning': 'This section requires knowledge of Git, GitHub Actions and access tokens. Use it carefully: a full run may take time and consume resources. GitHub Actions cannot access localhost: use a public URL or a tunnel.',
    'ci.refresh': 'Refresh',
    'ci.import': 'Import latest',
    'ci.importing': 'Importing…',
    'ci.config.title': 'Configuration required',
    'ci.config.text': 'To import runs automatically, configure the repository and a GitHub token with read access to Actions.',
    'ci.config.help': 'Add these variables to src/.env and restart the dashboard.',
    'ci.runs.title': 'Recent runs',
    'ci.scan.title': 'Imported scan',
    'ci.scan.empty': 'No scan has been imported yet.',
    'ci.scan.pages': 'Pages',
    'ci.scan.onePage': '1 page',
    'ci.scan.pagesCount': '{n} pages',
    'ci.scan.links': 'Links',
    'ci.scan.type': 'Type',
    'ci.scan.depth': 'Depth',
    'ci.scan.date': 'Date',
    'ci.scan.downloads': 'Skipped downloads',
    'ci.scan.invalid': 'Invalid links',
    'ci.scan.view': 'View scan',
    'ci.errors.title': 'Errors from imported report',
    'ci.errors.empty': 'The imported report did not record errors.',
    'ci.imported.title': 'Imported reports',
    'ci.imported.empty': 'No GitHub reports have been imported yet.',
    'ci.imported.viewReport': 'View report',
    'ci.imported.viewScan': 'View scan',
    'ci.imported.detail': 'View details',
    'ci.imported.delete': 'Delete report',
    'ci.imported.deleted': 'Imported report deleted.',
    'ci.help': 'Import a run so its scans and reports appear in Home, Scans and Runs.',
    'ci.empty': 'No recent runs.',
    'ci.last.title': 'Last import',
    'ci.last.none': 'You have not imported a run yet.',
    'ci.last.text': 'Run #{id} · {date}',
    'ci.status.success': 'Success',
    'ci.status.failure': 'Failure',
    'ci.status.cancelled': 'Cancelled',
    'ci.status.inProgress': 'In progress',
    'ci.status.queued': 'Queued',
    'ci.import.run': 'Import',
    'ci.imported': 'Imported',
    'ci.import.ok': 'Run imported. Refreshing the dashboard…',
    'ci.import.error': 'Could not import the run.',
    'ci.run.placeholder': 'https://example.com',
    'ci.run.start': 'Run on GitHub Actions',
    'ci.run.dispatching': 'Dispatching run…',
    'ci.run.sent': 'Run dispatched. Waiting for it to appear on GitHub…',
    'ci.run.waiting': 'Waiting for the GitHub Actions run…',
    'ci.run.error': 'Could not start the GitHub Actions run.',
    'ci.run.done': 'Remote run completed.',
    'ci.run.config': 'Workflow configuration',
    'ci.run.config.help': 'These values are sent to the workflow; they do not modify the YAML file.',
    'ci.run.scanType': 'Elements',
    'ci.run.depth': 'Depth',
    'ci.run.maxPages': 'Max pages',
    'ci.run.engine': 'Engine',
    'ci.run.browsers': 'Browsers',
    'ci.run.maxLinks': 'Links per page',
    'ci.auto': 'Automatic import enabled',
    'ci.manual': 'Manual import',
    'ci.open': 'Open on GitHub',
    'ci.branch': 'Branch',
    'ci.noConfig': 'GitHub Actions configuration is missing.',
    'about.title': 'What does CACHAI-QA do?',
    'about.tab.how': 'How it works',
    'about.tab.glossary': 'Glossary',
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
    'home.errors.unique': 'unique defects',
    'home.segment.success': 'Passed',
    'home.segment.warning': 'Warnings',
    'home.segment.error': 'Errors',
    'home.source.playwright': 'Playwright',
    'home.source.cucumber': 'Cucumber',
    'home.source.scan': 'Scan',
    'scans.title': 'Saved scans',
    'scans.empty': 'No scans in this category.',
    'scans.create.title': 'New full local audit',
    'scans.create.help': 'Enter a URL. Runs the crawler, test generation, Playwright, Cucumber and reports.',
    'scans.create.provider': 'Environment',
    'scans.create.provider.local': 'Local',
    'scans.create.provider.browserstack': 'BrowserStack (cloud)',
    'scans.create.provider.hint': 'BrowserStack runs Playwright in the cloud; Cucumber stays local.',
    'scans.create.provider.missing': 'Add the credentials in src/.env to enable BrowserStack.',
    'scans.create.placeholder': 'https://example.com',
    'scans.create.start': 'Run audit',
    'scans.create.cancel': 'Cancel',
    'scans.create.mode': 'Scan type',
    'scans.create.type': 'Elements',
    'scans.create.type.all': 'All',
    'scans.create.type.links': 'Links',
    'scans.create.type.images': 'Images',
    'scans.create.type.forms': 'Forms',
    'scans.create.type.buttons': 'Buttons',
    'scans.create.depth': 'Depth',
    'scans.create.maxPages': 'Max pages',
    'scans.create.running': 'Audit in progress…',
    'scans.create.doneBadge': 'Completed',
    'scans.create.failedBadge': 'Error',
    'scans.create.cancelledBadge': 'Cancelled',
    'scans.create.testsFailedBadge': 'With failures',
    'scans.create.invalid': 'Enter a valid HTTP or HTTPS URL.',
    'scans.create.done': 'Audit completed. Refreshing the dashboard…',
    'scans.create.testsFailed': 'Audit completed with test failures. Check Runs.',
    'scans.create.cancelled': 'Audit cancelled.',
    'scans.create.failed': 'The audit finished with errors.',
    'scans.filter.quick': '⚡ Quick',
    'scans.filter.full': '🌐 Full',
    'scans.filter.custom': '🎯 Custom',
    'scans.filter.automated': '🤖 Automated',
    'scans.filter.favorites': '⭐ Saved',
    'scans.emptyFavorites': 'You have not starred any scan yet. Use the star on a card.',
    'scans.favorite.add': 'Save scan',
    'scans.favorite.remove': 'Remove from saved',
    'scans.deleteConfirmRuns': 'Delete the scan "{name}"? Its associated Playwright and Cucumber runs will also be deleted. This cannot be undone.',
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
    'scans.group.crawl': 'Crawler scans',
    'scans.group.framework': 'Test generation summaries',
    'scans.group.unknown': 'Other files',
    'scans.deleteConfirm': 'Delete scan "{name}"? This cannot be undone.',
    'confirm.title': 'Confirm deletion',
    'scans.detail': 'Scan detail',
    'scans.noLinks': 'This file does not contain listed links.',
    'scans.showing': 'Showing the first {n} of {total} links.',
    'tests.spec': 'Generated specification (Playwright)',
    'tests.specCount': '{n} cases',
    'tests.reports': 'HTML reports',
    'tests.noSpec': 'No generated tests. Run option [4] first.',
    'tests.noReports': 'No reports yet.',
    'tests.showing': 'Showing the first {n} of {total} tests.',
    'tests.open': 'Open',
    'runs.title': 'Test runs',
    'runs.empty': 'No test runs yet.',
    'runs.date': 'Date',
    'runs.pages': 'Pages',
    'runs.pagesShort': 'pages',
    'runs.tests': 'Tests',
    'runs.open': 'Open report',
    'runs.preview': 'Preview',
    'runs.noUrl': 'URL unavailable',
    'runs.filter.playwright': '🎭 Playwright',
    'runs.filter.cucumber': '🥒 Cucumber',
    'runs.filter.browserstack': '☁️ BrowserStack',
    'runs.results': 'Run results',
    'runs.currentReport': 'View HTML report',
    'runs.currentReportCucumber': 'Open current HTML report',
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
    'runs.group.noUrl': 'No URL',
    'runs.group.count': '{n} runs',
    'runs.group.countOne': '1 run',
    'runs.group.countCucumber': '{n} reports',
    'runs.group.countCucumberOne': '1 report',
    'runs.executionNumber': 'Run {n}',
    'runs.reportNumber': 'Report {n}',
    'runs.bdd.summary': 'Features: {features} · Scenarios: {scenarios} · Steps: {steps}',
    'runs.noCounts': 'No metrics',
    'runs.latestExecution': 'Latest run',
    'runs.latestReport': 'Latest report',
    'runs.current': 'Current',
    'runs.selected': 'Viewing {name} · {date}',
    'runs.backToLatest': 'Back to latest',
    'runs.selectedLoading': 'Loading run results…',
    'runs.selectedError': 'Could not load the results for this run.',
    'runs.delete': 'Delete run',
    'runs.deleteConfirm': 'Delete the run from {date}? Its HTML report and related data will be removed.',
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
    'runs.browserstack.configured': 'Credentials configured',
    'runs.browserstack.notConfigured': 'Credentials missing',
    'runs.browserstack.hint': 'To run in the cloud, just add BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY in src/.env. Project, build and browsers are configured automatically.',
    'runs.browserstack.history': 'Cloud runs',
    'runs.browserstack.empty': 'No BrowserStack runs yet.',
    'runs.browserstack.report': 'View report',
    'runs.browserstack.open': 'Open on BrowserStack',
    'runs.browserstack.delete': 'Delete run',
    'runs.browserstack.local': 'Local tunnel',
    'runs.browserstack.cloud': 'Cloud',
    'error.location': 'Error location',
    'error.affected': 'Affected URL',
    'error.browser': 'Browser',
    'error.occurrences': 'Occurrences',
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
    'toast.runDeleted': 'Run deleted',
    'toast.error': 'Something went wrong',
    'toast.refreshed': 'Refreshed'
  }
};

const ABOUT = {
  es: {
    intro: 'CACHAI-QA es un framework de auditoría y pruebas automatizadas: escanea un sitio, genera pruebas a partir de lo que encuentra, las ejecuta en varios navegadores y deja la evidencia en reportes y en un dashboard local. También puede ejecutarse en BrowserStack o en GitHub Actions.',
    howTitle: 'Cómo funciona',
    howSubtitle: 'El flujo actual, de principio a fin.',
    steps: [
      { title: 'Escaneo', text: 'Playwright recorre la URL y guarda páginas, enlaces, formularios e imágenes en un JSON. Puedes elegir un escaneo Rápido, Completo o Personalizado.' },
      { title: 'Generación', text: 'TypeScript transforma ese JSON en un spec de Playwright y en escenarios Gherkin con sus steps de Cucumber. El flujo usa helpers y test.describe; no hay una capa formal de Page Objects.' },
      { title: 'Ejecución', text: 'Playwright corre en Chromium, Chrome, Firefox o BrowserStack (Chrome, Firefox y WebKit/Safari); Cucumber usa Chromium por defecto. La auditoría del dashboard permite cancelar mientras corre.' },
      { title: 'Resultados', text: 'Se generan reportes HTML/JSON de ambos motores, métricas, defectos únicos y un dashboard con Inicio, Escaneos, Ejecuciones y GitHub Actions.' },
      { title: 'GitHub Actions', text: 'El workflow manual permite ejecutar el flujo en la nube, importar sus artefactos, revisar errores y eliminar reportes importados. Requiere token y una URL pública.' }
    ],
    techTitle: 'Tecnologías',
    techSubtitle: 'Lo que se usa hoy y lo que está planificado.',
    tech: [
      { name: 'Node.js 22+', text: 'Entorno de ejecución del framework, Cucumber y el panel local.', current: true },
      { name: 'TypeScript', text: 'Lógica de escaneo, generación de pruebas y tipado del proyecto.', current: true },
      { name: 'Playwright', text: 'Automatización del navegador y motor de escaneo.', current: true },
      { name: 'Gherkin + Cucumber', text: 'Escenarios en lenguaje natural y ejecución BDD.', current: true },
      { name: 'GitHub Actions', text: 'Workflow manual, artefactos, importación y reportes remotos.', current: true },
      { name: 'Dashboard local', text: 'Panel de escaneos, ejecuciones, auditoría local y reportes CI.', current: true },
      { name: 'BrowserStack', text: 'Chrome, Firefox y WebKit/Safari en la nube. Solo requiere usuario y access key.', current: true }
    ],
    planned: 'Planificado',
    current: 'En uso',
    glossaryTitle: 'Glosario de errores comunes',
    glossarySubtitle: 'Qué significa cada término que aparece en el panel.',
    glossary: [
      {
        title: 'Enlaces y red',
        items: [
          { term: '404 / 4xx / 5xx', def: 'El servidor respondió con un error HTTP. Un 404 significa que la URL no existe; un 5xx indica un fallo del servidor.' },
          { term: 'Timeout / sin verificar', def: 'La comprobación no terminó a tiempo. No se cuenta como enlace roto: queda pendiente de revisar.' },
          { term: 'Enlace duplicado', def: 'La misma URL aparece varias veces; se cuenta una sola vez para no inflar los resultados.' },
          { term: 'Redirección', def: 'La URL responde con un 3xx y lleva a otra dirección.' }
        ]
      },
      {
        title: 'Errores de JavaScript',
        items: [
          { term: 'Error de consola', def: 'Excepción lanzada por la página durante la carga o la interacción.' },
          { term: 'TypeError', def: 'Se intentó usar un valor de un tipo incorrecto, por ejemplo una función que no existe.' },
          { term: 'Referencia indefinida', def: 'El código usa una variable o librería que no está cargada.' },
          { term: 'null inesperado', def: 'Un elemento o propiedad que el script esperaba encontrar no existe.' }
        ]
      },
      {
        title: 'Ejecución',
        items: [
          { term: 'Passed / Failed / Skipped', def: 'Prueba aprobada, fallida u omitida.' },
          { term: 'Flaky', def: 'Prueba que a veces pasa y a veces falla sin cambios en el código.' },
          { term: 'Worker / paralelismo', def: 'Cantidad de pruebas que se ejecutan al mismo tiempo.' },
          { term: 'Reintento', def: 'Repetición automática de una comprobación antes de marcarla como fallida.' },
          { term: 'Trace', def: 'Grabación paso a paso de una prueba para depurarla.' }
        ]
      },
      {
        title: 'BDD y datos',
        items: [
          { term: 'Feature', def: 'Archivo Gherkin que agrupa los escenarios de una funcionalidad.' },
          { term: 'Escenario', def: 'Caso de prueba escrito en lenguaje natural.' },
          { term: 'Step', def: 'Cada línea Given / When / Then de un escenario.' },
          { term: 'Hook', def: 'Código que se ejecuta antes o después de un escenario.' },
          { term: 'Escaneo / crawl', def: 'Recorrido automático del sitio que produce el JSON de entrada.' },
          { term: 'Defecto único', def: 'Fallo agrupado por código y URL, sin contar cada navegador por separado.' }
        ]
      },
      {
        title: 'GitHub Actions y automatización',
        items: [
          { term: 'Workflow', def: 'Archivo YAML de GitHub Actions que define los jobs de escaneo, pruebas y reportes.' },
          { term: 'workflow_dispatch', def: 'Ejecución manual del workflow con parámetros como URL, profundidad o motor.' },
          { term: 'Artifact', def: 'Archivo o carpeta que GitHub Actions publica al terminar; por ejemplo, scan y reports.' },
          { term: 'Token', def: 'Credencial de GitHub con permisos de lectura para listar ejecuciones y descargar artefactos.' },
          { term: 'Reporte importado', def: 'Copia local de un reporte de GitHub Actions, disponible para ver, detallar o eliminar.' },
          { term: 'Auditoría local', def: 'Ejecución completa desde el dashboard: crawler, generación, Playwright, Cucumber y reportes.' }
        ]
      }
    ]
  },
  en: {
    intro: 'CACHAI-QA is an audit and automated testing framework: it scans a site, generates tests from what it finds, runs them across several browsers and leaves the evidence in reports and a local dashboard. It can also run on BrowserStack or GitHub Actions.',
    howTitle: 'How it works',
    howSubtitle: 'The current flow, from start to finish.',
    steps: [
      { title: 'Scan', text: 'Playwright walks the URL and stores pages, links, forms and images in a JSON file. You can choose a Quick, Full or Custom scan.' },
      { title: 'Generation', text: 'TypeScript turns that JSON into a Playwright spec and Gherkin scenarios with Cucumber steps. The flow uses helpers and test.describe; there is no formal Page Object layer.' },
      { title: 'Execution', text: 'Playwright runs on Chromium, Chrome, Firefox or BrowserStack (Chrome, Firefox and WebKit/Safari); Cucumber uses Chromium by default. The dashboard audit can be cancelled while running.' },
      { title: 'Results', text: 'HTML/JSON reports from both engines, metrics, unique defects and a dashboard with Home, Scans, Runs and GitHub Actions are produced.' },
      { title: 'GitHub Actions', text: 'The manual workflow runs the flow in the cloud, imports artifacts, reviews errors and deletes imported reports. It requires a token and a public URL.' }
    ],
    techTitle: 'Technologies',
    techSubtitle: 'What is used today and what is planned.',
    tech: [
      { name: 'Node.js 22+', text: 'Runtime for the framework, Cucumber and the local panel.', current: true },
      { name: 'TypeScript', text: 'Scan logic, test generation and project typing.', current: true },
      { name: 'Playwright', text: 'Browser automation and scanning engine.', current: true },
      { name: 'Gherkin + Cucumber', text: 'Natural-language scenarios and BDD execution.', current: true },
      { name: 'GitHub Actions', text: 'Manual workflow, artifacts, import and remote reports.', current: true },
      { name: 'Local dashboard', text: 'Scans, runs, local audit and CI reports panel.', current: true },
      { name: 'BrowserStack', text: 'Chrome, Firefox and WebKit/Safari in the cloud. Only username and access key required.', current: true }
    ],
    planned: 'Planned',
    current: 'In use',
    glossaryTitle: 'Common error glossary',
    glossarySubtitle: 'What each term in the panel means.',
    glossary: [
      {
        title: 'Links & network',
        items: [
          { term: '404 / 4xx / 5xx', def: 'The server returned an HTTP error. A 404 means the URL does not exist; a 5xx means a server failure.' },
          { term: 'Timeout / unverified', def: 'The check did not finish in time. It is not counted as a broken link; it stays pending review.' },
          { term: 'Duplicate link', def: 'The same URL appears several times; it is counted once so results are not inflated.' },
          { term: 'Redirect', def: 'The URL answers with a 3xx and points to another address.' }
        ]
      },
      {
        title: 'JavaScript errors',
        items: [
          { term: 'Console error', def: 'An exception thrown by the page during load or interaction.' },
          { term: 'TypeError', def: 'A value was used as the wrong type, for example a function that does not exist.' },
          { term: 'Undefined reference', def: 'The code uses a variable or library that is not loaded.' },
          { term: 'Unexpected null', def: 'An element or property the script expected to find does not exist.' }
        ]
      },
      {
        title: 'Execution',
        items: [
          { term: 'Passed / Failed / Skipped', def: 'Test approved, failed or omitted.' },
          { term: 'Flaky', def: 'A test that sometimes passes and sometimes fails without any code change.' },
          { term: 'Worker / parallelism', def: 'How many tests run at the same time.' },
          { term: 'Retry', def: 'Automatic repetition of a check before marking it as failed.' },
          { term: 'Trace', def: 'Step-by-step recording of a test for debugging.' }
        ]
      },
      {
        title: 'BDD & data',
        items: [
          { term: 'Feature', def: 'Gherkin file that groups the scenarios of a feature.' },
          { term: 'Scenario', def: 'Test case written in natural language.' },
          { term: 'Step', def: 'Each Given / When / Then line of a scenario.' },
          { term: 'Hook', def: 'Code that runs before or after a scenario.' },
          { term: 'Scan / crawl', def: 'Automatic walk of the site that produces the input JSON.' },
          { term: 'Unique defect', def: 'Failure grouped by code and URL, without counting each browser separately.' }
        ]
      },
      {
        title: 'GitHub Actions and automation',
        items: [
          { term: 'Workflow', def: 'GitHub Actions YAML file that defines the scan, test and report jobs.' },
          { term: 'workflow_dispatch', def: 'Manual workflow run with parameters such as URL, depth or engine.' },
          { term: 'Artifact', def: 'File or folder published by GitHub Actions, for example scan and reports.' },
          { term: 'Token', def: 'GitHub credential with read permissions to list runs and download artifacts.' },
          { term: 'Imported report', def: 'Local copy of a GitHub Actions report that can be viewed, detailed or deleted.' },
          { term: 'Local audit', def: 'Full dashboard run: crawler, generation, Playwright, Cucumber and reports.' }
        ]
      }
    ]
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
  syncBrowserStackOptions();
  renderCi();
  renderAbout();
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

  const totalErrors = Number(data && data.counts && data.counts.errors) || list.length;
  const uniqueEl = $('#home-errors-unique');
  countEl.textContent = num(totalErrors);
  if (uniqueEl) {
    uniqueEl.hidden = list.length === 0 || list.length === totalErrors;
    uniqueEl.textContent = `${num(list.length)} ${t('home.errors.unique')}`;
  }

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
  const browsers = Array.isArray(error.browsers) && error.browsers.length
    ? error.browsers
    : (error.browser ? [error.browser] : []);
  const occurrences = Number(error.occurrences) || 1;
  const summaryText = [
    occurrences > 1 ? '×' + occurrences : '',
    browsers.length ? '[' + browsers.join(', ') + ']' : '',
    sourceText,
    error.feature || '',
    error.summary || '',
    originPath !== '—' ? originPath : ''
  ]
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
            ${browsers.length ? `<p><strong>${t('error.browser')}:</strong> <code>${esc(browsers.join(', '))}</code></p>` : ''}
            ${occurrences > 1 ? `<p><strong>${t('error.occurrences')}:</strong> ${num(occurrences)}</p>` : ''}
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

function renderErrorCards(errors, container, empty, countEl, limit, totalCount) {
  if (!container) return;
  const list = Array.isArray(errors) ? errors : [];
  const visible = limit ? list.slice(0, limit) : list;
  container.innerHTML = visible.map(errorCardHtml).join('');
  if (list.length > visible.length) {
    container.innerHTML += `<button type="button" class="btn" data-error-detail>${t('home.errors.showAll', { n: num(list.length) })}</button>`;
  }
  if (empty) empty.hidden = list.length > 0;
  if (countEl) countEl.textContent = num(totalCount != null ? totalCount : list.length);
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

    // Depura favoritos de archivos que ya no existen.
    const valid = new Set(state.scans.map((scan) => scan.file));
    const favorites = state.scanFavorites.filter((file) => valid.has(file));
    if (favorites.length !== state.scanFavorites.length) {
      state.scanFavorites = favorites;
      localStorage.setItem('cq.scanFavorites', JSON.stringify(state.scanFavorites));
    }

    // Si la categoría activa quedó vacía, abrir la del escaneo más reciente.
    if (state.scans.length > 0 && state.scanFilter !== 'favorites') {
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
  if (type === 'automated') return t('scans.filter.automated');
  return t('scans.filter.custom');
}

let scanPollTimer = null;

function renderScanJob() {
  const status = $('#scan-job-status');
  const badge = $('#scan-job-badge');
  const log = $('#scan-job-log');
  const button = $('#scan-start');
  const job = state.scanJob;
  if (!status || !badge || !log || !button) return;

  if (!job) {
    status.textContent = '';
    badge.textContent = '';
    log.hidden = true;
    button.disabled = false;
    const cancel = $('#scan-cancel');
    if (cancel) cancel.hidden = true;
    const progressWrap = $('#scan-progress-wrap');
    if (progressWrap) progressWrap.hidden = true;
    return;
  }

  button.disabled = Boolean(job.running);
  const cancelButton = $('#scan-cancel');
  if (cancelButton) cancelButton.hidden = !job.running;
  const progressWrap = $('#scan-progress-wrap');
  const progress = $('#scan-progress');
  const progressLabel = $('#scan-progress-label');
  if (progressWrap && progress) {
    const stagePercent = { scan: 15, playwright: 45, cucumber: 75, reportes: 95 };
    progressWrap.hidden = false;
    progress.value = job.running ? (stagePercent[job.stage] || 5) : 100;
    if (progressLabel) {
      progressLabel.textContent = job.running
        ? (job.stage || '…')
        : job.cancelled
          ? t('scans.create.cancelledBadge')
          : `${t('scans.create.doneBadge')} 100%`;
    }
  }
  badge.textContent = job.running
    ? t('scans.create.running')
    : job.cancelled
      ? t('scans.create.cancelledBadge')
      : job.testsFailed
        ? t('scans.create.testsFailedBadge')
        : job.exitCode === 0
          ? t('scans.create.doneBadge')
          : t('scans.create.failedBadge');

  if (job.running) {
    const provider = job.provider === 'browserstack' ? ' · BrowserStack' : '';
    status.textContent = `${t('scans.create.running')} ${job.url || ''}${provider}${job.stage ? ' · ' + job.stage : ''}`.trim();
  } else if (job.cancelled) {
    status.textContent = t('scans.create.cancelled');
  } else if (job.error) {
    status.textContent = job.error;
  } else if (job.testsFailed) {
    status.textContent = t('scans.create.testsFailed');
  } else {
    status.textContent = job.exitCode === 0 ? t('scans.create.done') : t('scans.create.failed');
  }

  const lines = Array.isArray(job.log) ? job.log : [];
  log.textContent = lines.join('\n');
  log.hidden = lines.length === 0;
}

async function handleScanFinished(job) {
  if (job.cancelled) {
    toast(t('scans.create.cancelled'));
    await loadScans();
    return;
  }
  if (job.exitCode === 0) {
    toast(job.testsFailed ? t('scans.create.testsFailed') : t('scans.create.done'), Boolean(job.testsFailed));
    state.scanFilter = job.mode && ['quick', 'full', 'custom'].includes(job.mode) ? job.mode : 'full';
    await Promise.all([loadScans(), loadTests(), loadRuns(), loadOverview()]);
  } else {
    toast(job.error || t('scans.create.failed'), true);
  }
}

async function pollScanJob() {
  clearTimeout(scanPollTimer);
  scanPollTimer = null;
  try {
    const res = await fetch('/api/audit/status');
    const job = await res.json();
    const wasRunning = Boolean(state.scanJob && state.scanJob.running);
    state.scanJob = job;
    renderScanJob();
    if (job.running) {
      scanPollTimer = setTimeout(pollScanJob, 1500);
    } else if (wasRunning) {
      await handleScanFinished(job);
    }
  } catch (e) {
    toast(String(e && e.message ? e.message : e), true);
  }
}

async function loadScanJob() {
  try {
    const res = await fetch('/api/audit/status');
    state.scanJob = await res.json();
    renderScanJob();
    if (state.scanJob && state.scanJob.running) {
      clearTimeout(scanPollTimer);
      scanPollTimer = setTimeout(pollScanJob, 1500);
    }
  } catch {
    renderScanJob();
  }
}

function syncScanMode() {
  const mode = ($('#scan-mode') && $('#scan-mode').value) || 'full';
  const custom = $('#scan-custom');
  if (custom) custom.hidden = mode !== 'custom';
}

async function startScan() {
  const input = $('#scan-url');
  const url = input ? input.value.trim() : '';
  if (!/^https?:\/\/[^\s]+$/i.test(url)) {
    toast(t('scans.create.invalid'), true);
    return;
  }

  const mode = ($('#scan-mode') && $('#scan-mode').value) || 'full';
  const provider = ($('#scan-provider') && $('#scan-provider').value) || 'local';
  const customType = ($('#scan-custom-type') && $('#scan-custom-type').value) || 'all';
  const customDepth = Number($('#scan-depth') && $('#scan-depth').value);
  const customPages = Number($('#scan-max-pages') && $('#scan-max-pages').value);

  const button = $('#scan-start');
  if (button) button.disabled = true;
  try {
    const res = await fetch('/api/audit/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        mode,
        provider,
        scanType: customType,
        depth: customDepth,
        maxPages: customPages
      })
    });
    const job = await res.json();
    if (!res.ok) throw new Error(job.error || t('scans.create.failed'));
    state.scanJob = job;
    renderScanJob();
    scanPollTimer = setTimeout(pollScanJob, 1000);
  } catch (e) {
    if (button) button.disabled = false;
    toast(String(e && e.message ? e.message : e), true);
  }
}

async function cancelScan() {
  try {
    const res = await fetch('/api/audit/cancel', { method: 'POST' });
    const job = await res.json();
    if (!res.ok) throw new Error(job.error || t('scans.create.failed'));
    state.scanJob = job;
    renderScanJob();
  } catch (e) {
    toast(String(e && e.message ? e.message : e), true);
  }
}

function renderScans() {
  const list = $('#scans-list');
  const empty = $('#scans-empty');
  if (!list) return;

  const scans = state.scans || [];
  $('#scans-count').textContent = num(scans.length);

  for (const type of ['quick', 'full', 'custom', 'automated']) {
    const count = scans.filter((scan) => (scan.scanType || 'custom') === type).length;
    $$(`[data-scan-count="${type}"]`).forEach((el) => { el.textContent = num(count); });
  }
  const favoriteCount = scans.filter((scan) => state.scanFavorites.includes(scan.file)).length;
  $$('[data-scan-count="favorites"]').forEach((el) => { el.textContent = num(favoriteCount); });

  $$('[data-scan-filter]').forEach((button) => {
    button.classList.toggle('active', button.dataset.scanFilter === state.scanFilter);
  });

  const filtered = state.scanFilter === 'favorites'
    ? scans.filter((scan) => state.scanFavorites.includes(scan.file))
    : scans.filter((scan) => (scan.scanType || 'custom') === state.scanFilter);
  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    empty.textContent = state.scanFilter === 'favorites' ? t('scans.emptyFavorites') : t('scans.empty');
    return;
  }
  empty.hidden = true;

  const groups = [
    { kind: 'crawl', label: t('scans.group.crawl') },
    { kind: 'framework', label: t('scans.group.framework') },
    { kind: 'unknown', label: t('scans.group.unknown') }
  ];

  const cardFor = (scan) => {
    const kind = scan.kind || 'unknown';
    const favorite = state.scanFavorites.includes(scan.file);
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
      <article class="scan scan--${esc(kind)}${favorite ? ' scan--favorite' : ''}">
        <span class="scan-accent" aria-hidden="true"></span>
        <div class="scan-top">
          <div>
            <h3 class="scan-name">${esc(scan.name)}</h3>
            <div class="scan-url">${esc(scan.url || '—')}</div>
          </div>
          <div class="scan-actions">
            <button type="button" class="btn favorite-btn${favorite ? ' active' : ''}" data-favorite="${esc(scan.file)}"
              aria-pressed="${favorite ? 'true' : 'false'}"
              title="${esc(favorite ? t('scans.favorite.remove') : t('scans.favorite.add'))}"
              aria-label="${esc(favorite ? t('scans.favorite.remove') : t('scans.favorite.add'))}">
              <span aria-hidden="true">${favorite ? '★' : '☆'}</span>
            </button>
            <button type="button" class="btn" data-view="${esc(scan.file)}">${t('common.view')}</button>
            <button type="button" class="btn danger" data-delete="${esc(scan.file)}">${t('common.delete')}</button>
          </div>
        </div>
        <div class="scan-meta">${meta.join('')}</div>
      </article>`;
  };

  list.innerHTML = groups.map((group) => {
    const items = filtered.filter((scan) => (scan.kind || 'unknown') === group.kind);
    if (items.length === 0) return '';
    return `
      <div class="scan-group" role="group" aria-label="${esc(group.label)}">
        <div class="scan-group-head scan-group-head--${esc(group.kind)}">
          <span class="scan-group-dot" aria-hidden="true"></span>
          <span>${esc(group.label)}</span>
          <span class="badge">${num(items.length)}</span>
        </div>
        ${items.map(cardFor).join('')}
      </div>`;
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

function toggleFavorite(file) {
  const index = state.scanFavorites.indexOf(file);
  if (index >= 0) state.scanFavorites.splice(index, 1);
  else state.scanFavorites.push(file);
  localStorage.setItem('cq.scanFavorites', JSON.stringify(state.scanFavorites));
  renderScans();
}

async function deleteScan(file) {
  const scan = state.scans.find((item) => item.file === file);
  const linked = (state.runs || []).some((run) => run.summaryFile === file)
    || Boolean(scan && scan.kind === 'crawl'
      && (state.scans || []).some((item) => item.kind === 'framework' && item.scanSource === file));
  const message = t(linked ? 'scans.deleteConfirmRuns' : 'scans.deleteConfirm', {
    name: scan ? scan.name : file
  });
  const ok = await confirmAction(message);
  if (!ok) return;
  try {
    const res = await fetch('/api/scan?file=' + encodeURIComponent(file), { method: 'DELETE' });
    const json = await res.json();
    if (json.error) { toast(json.error, true); return; }

    if (state.scanFavorites.includes(file)) {
      state.scanFavorites = state.scanFavorites.filter((item) => item !== file);
      localStorage.setItem('cq.scanFavorites', JSON.stringify(state.scanFavorites));
    }

    toast(t('toast.deleted'));
    await Promise.all([loadScans(), loadOverview(), loadRuns(), loadTests()]);
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

function activeRun(kind) {
  if (state.selectedRun[kind]) {
    return state.runDetail[kind] || { available: false, loading: state.runDetailLoading[kind] };
  }
  return state.overview ? state.overview[kind] : null;
}

function runOrdinal(kind, reportPath) {
  const runs = (state.runs || []).filter((run) => run.type === kind);
  const target = runs.find((run) => run.reportPath === reportPath);
  if (!target) return 0;
  const key = runGroupKey(target);
  const group = runs
    .filter((run) => runGroupKey(run) === key)
    .sort((a, b) => runTimestamp(a) - runTimestamp(b));
  return group.findIndex((run) => run.reportPath === reportPath) + 1;
}

function renderRunBanner(kind) {
  const banner = $(`#${kind}-run-banner`);
  if (!banner) return;

  const selected = state.selectedRun[kind];
  if (!selected) {
    banner.hidden = true;
    banner.innerHTML = '';
    return;
  }

  const run = (state.runs || []).find((item) => item.reportPath === selected);
  const numberKey = kind === 'cucumber' ? 'runs.reportNumber' : 'runs.executionNumber';
  const ordinal = runOrdinal(kind, selected);
  const name = ordinal ? t(numberKey, { n: ordinal }) : '';
  const date = run ? fmtDateShort(runTimestamp(run)) : '';

  banner.hidden = false;
  banner.innerHTML = `
    <span class="run-banner-text">${state.runDetailLoading[kind]
      ? esc(t('runs.selectedLoading'))
      : esc(t('runs.selected', { name, date }))}</span>
    <button type="button" class="btn" data-run-latest="${esc(kind)}">${t('runs.backToLatest')}</button>`;
}

async function selectRun(kind, reportPath) {
  if (!reportPath) return;
  state.selectedRun[kind] = reportPath;
  state.runDetail[kind] = null;
  state.runDetailLoading[kind] = true;
  renderTests();
  renderRuns();

  try {
    const res = await fetch('/api/run?path=' + encodeURIComponent(reportPath));
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    if (state.selectedRun[kind] !== reportPath) return;
    state.runDetail[kind] = json;
  } catch {
    if (state.selectedRun[kind] === reportPath) toast(t('runs.selectedError'), true);
  } finally {
    if (state.selectedRun[kind] === reportPath) {
      state.runDetailLoading[kind] = false;
      renderTests();
      renderRuns();
    }
  }
}

function clearSelectedRun(kind) {
  state.selectedRun[kind] = null;
  state.runDetail[kind] = null;
  state.runDetailLoading[kind] = false;
  renderTests();
  renderRuns();
}

async function deleteRun(kind, reportPath) {
  const run = (state.runs || []).find((item) => item.reportPath === reportPath);
  const ok = await confirmAction(t('runs.deleteConfirm', { date: run ? fmtDate(runTimestamp(run)) : '' }));
  if (!ok) return;

  try {
    const res = await fetch('/api/run?path=' + encodeURIComponent(reportPath), { method: 'DELETE' });
    const json = await res.json();
    if (json.error) { toast(json.error, true); return; }

    if (state.selectedRun[kind] === reportPath) {
      state.selectedRun[kind] = null;
      state.runDetail[kind] = null;
      state.runDetailLoading[kind] = false;
    }
    toast(t('toast.runDeleted'));
    await Promise.all([loadOverview(), loadRuns(), loadTests(), loadScans()]);
  } catch {
    toast(t('toast.error'), true);
  }
}

function renderTests() {
  const tests = state.tests;
  const spec = tests ? tests.spec : null;
  const selectedCucumber = state.selectedRun.cucumber ? state.runDetail.cucumber : null;
  const bddMetrics = selectedCucumber && selectedCucumber.totals
    ? selectedCucumber.totals
    : (tests ? tests.bddMetrics : null);
  const cucumber = selectedCucumber && Array.isArray(selectedCucumber.features)
    ? selectedCucumber
    : (tests ? tests.cucumber : null);

  const specPath = $('#tests-spec-path');
  if (specPath) specPath.textContent = spec && spec.exists ? spec.path : '';

  const testsEmpty = $('#tests-empty');
  if (testsEmpty) testsEmpty.hidden = Boolean(spec && spec.exists);

  const specTests = spec && Array.isArray(spec.tests) ? spec.tests : [];
  const cases = $('#tests-cases');
  if (cases) {
    const limit = 20;
    cases.innerHTML = specTests.slice(0, limit).map((name) => `<li>${esc(name)}</li>`).join('');
    if (specTests.length > limit) {
      cases.innerHTML += `<li class="muted">${esc(t('tests.showing', { n: limit, total: specTests.length }))}</li>`;
    }
  }

  const specCount = $('#tests-spec-count');
  if (specCount) {
    specCount.textContent = spec && spec.exists && specTests.length
      ? t('tests.specCount', { n: specTests.length })
      : '';
  }

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

  const bddBadge = $('#bdd-status-badge');
  if (bddBadge) {
    const features = Number(bddMetrics && bddMetrics.totalFeatures)
      || (cucumber && Array.isArray(cucumber.features) ? cucumber.features.length : 0);
    const scenarios = Number(bddMetrics && bddMetrics.totalScenarios)
      || (cucumber && Array.isArray(cucumber.features)
        ? cucumber.features.reduce((sum, feature) => sum + (feature.scenarios || []).length, 0)
        : 0);
    const steps = Number(bddMetrics && bddMetrics.totalSteps)
      || (cucumber && Array.isArray(cucumber.features)
        ? cucumber.features.reduce(
          (sum, feature) => sum + (feature.scenarios || []).reduce(
            (inner, scenario) => inner + (scenario.steps || []).length,
            0
          ),
          0
        )
        : 0);
    bddBadge.textContent = features || scenarios || steps
      ? t('runs.bdd.summary', { features, scenarios, steps })
      : 'BDD';
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

  renderRunBanner('playwright');
  renderRunBanner('cucumber');

  const playwright = activeRun('playwright');
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
    10,
    playwrightAvailable ? playwright.errors : 0
  );

  const cucumberExecution = activeRun('cucumber');
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
    10,
    cucumberExecution && cucumberExecution.available ? cucumberExecution.errors : 0
  );
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

  // Si la ejecución seleccionada ya no existe (por ejemplo, se eliminó su
  // escaneo), se vuelve automáticamente a la última ejecución.
  for (const kind of ['playwright', 'cucumber']) {
    const selected = state.selectedRun[kind];
    if (selected && !runs.some((run) => run.type === kind && run.reportPath === selected)) {
      state.selectedRun[kind] = null;
      state.runDetail[kind] = null;
      state.runDetailLoading[kind] = false;
    }
  }

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

  const allPlaywrightRuns = runs.filter((run) => run.type === 'playwright');
  const allCucumberRuns = runs.filter((run) => run.type === 'cucumber');
  const currentPlaywright = resolveCurrentPath(allPlaywrightRuns, playwrightExecution);
  const currentCucumber = resolveCurrentPath(allCucumberRuns, cucumberExecution);

  const playwrightRuns = withCurrentStats(allPlaywrightRuns, currentPlaywright, playwrightExecution);
  const cucumberRuns = withCurrentStats(allCucumberRuns, currentCucumber, cucumberExecution);

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
  renderBrowserStackPanel();
}

async function loadBrowserStack() {
  try {
    const res = await fetch('/api/browserstack/status');
    state.browserstack = await res.json();
  } catch {
    state.browserstack = { configured: false, defaults: [] };
  }
  syncBrowserStackOptions();
  renderBrowserStackPanel();
}

function syncBrowserStackOptions() {
  const select = $('#scan-provider');
  const hint = $('#scan-provider-hint');
  const status = state.browserstack || { configured: false };
  if (!select) return;
  const option = select.querySelector('option[value="browserstack"]');
  if (option) {
    option.disabled = !status.configured;
    option.textContent = status.configured
      ? t('scans.create.provider.browserstack')
      : `${t('scans.create.provider.browserstack')} — ${t('runs.browserstack.notConfigured')}`;
  }
  if (!status.configured && select.value === 'browserstack') select.value = 'local';
  if (hint) {
    hint.textContent = status.configured
      ? t('scans.create.provider.hint')
      : t('scans.create.provider.missing');
  }
}

function renderBrowserStackPanel() {
  const status = state.browserstack || { configured: false, defaults: [] };
  const badge = $('#browserstack-status-badge');
  const text = $('#browserstack-status-text');
  const defaults = $('#browserstack-defaults');
  const list = $('#runs-list-browserstack');
  const empty = $('#runs-empty-browserstack');
  const count = $('#browserstack-runs-count');
  if (!list || !empty || !count) return;

  if (badge) {
    badge.textContent = status.configured
      ? t('runs.browserstack.configured')
      : t('runs.browserstack.notConfigured');
    badge.className = 'badge ' + (status.configured ? 'ok' : 'warn');
  }
  if (text) {
    text.textContent = status.configured
      ? 'Chrome, Firefox y WebKit/Safari en la nube. Solo se usan las credenciales de src/.env.'
      : 'Agrega BROWSERSTACK_USERNAME y BROWSERSTACK_ACCESS_KEY en src/.env para habilitar la nube.';
  }
  if (defaults) {
    const items = Array.isArray(status.defaults) ? status.defaults : [];
    defaults.innerHTML = items.map((item) => `<span class="badge">${esc(item.label)}</span>`).join('');
  }

  const runs = (state.runs || [])
    .filter((run) => run.provider === 'browserstack' || run.browserstack)
    .sort((a, b) => runTimestamp(b) - runTimestamp(a));
  count.textContent = num(runs.length);
  if (runs.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  list.innerHTML = runs.map((run) => {
    const meta = run.browserstack || {};
    const report = run.reportPath
      ? `<a class="btn" href="/${esc(run.reportPath)}" target="_blank" rel="noopener">${esc(t('runs.browserstack.report'))}</a>`
      : '';
    const external = meta.dashboardUrl
      ? `<a class="btn ghost" href="${esc(meta.dashboardUrl)}" target="_blank" rel="noopener">${esc(t('runs.browserstack.open'))}</a>`
      : '';
    const local = meta.local ? ` <span class="badge">${esc(t('runs.browserstack.local'))}</span>` : '';
    const browsers = Array.isArray(meta.browsers) && meta.browsers.length
      ? meta.browsers.map((browser) => `<span class="badge">${esc(browser)}</span>`).join(' ')
      : '';
    return `
      <article class="browserstack-run">
        <div class="browserstack-run-main">
          <div class="browserstack-run-title">
            <strong>${esc(fmtDateShort(runTimestamp(run)))}</strong>
            <span class="badge info">${esc(t('runs.browserstack.cloud'))}</span>${local}
          </div>
          <p class="scan-url">${esc(run.url || '—')}</p>
          <p class="muted">${esc(runCounts(run))}${meta.build ? ` · build: ${esc(meta.build)}` : ''}</p>
          <div class="browserstack-run-browsers">${browsers}</div>
        </div>
        <div class="browserstack-run-actions">
          ${report}
          ${external}
          <button type="button" class="btn danger" data-browserstack-delete="${esc(run.reportPath)}"
            title="${esc(t('runs.browserstack.delete'))}" aria-label="${esc(t('runs.browserstack.delete'))}">✕</button>
        </div>
      </article>`;
  }).join('');
}

function resolveCurrentPath(runs, execution) {
  if (!execution) return null;
  const exact = runs.find((run) => run.reportPath === execution.reportPath);
  if (exact) return exact.reportPath;

  if (execution.timestamp) {
    const close = runs.find((run) => Math.abs(run.mtime - execution.timestamp) < 5000);
    if (close) return close.reportPath;
  }

  // El overview de Cucumber apunta al reporte estático; se usa la copia
  // fechada más reciente para poder marcarla como ejecución actual.
  if (/\/cucumber-report\.html$/i.test(execution.reportPath || '')) {
    const latest = [...runs].sort((a, b) => runTimestamp(b) - runTimestamp(a))[0];
    if (latest) return latest.reportPath;
  }

  return execution.reportPath || null;
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

function runGroupKey(run) {
  const raw = String((run && run.url) || '').trim();
  if (!raw) return 'sin-url';
  try {
    const parsed = new URL(raw);
    return parsed.host || 'sin-url';
  } catch {
    const fallback = raw.replace(/^https?:\/\//i, '').split('/')[0].trim();
    return fallback || 'sin-url';
  }
}

function groupCountLabel(kind, total) {
  if (kind === 'cucumber') {
    return total === 1 ? t('runs.group.countCucumberOne') : t('runs.group.countCucumber', { n: total });
  }
  return total === 1 ? t('runs.group.countOne') : t('runs.group.count', { n: total });
}

function runCounts(run) {
  const hasCounts = run.passed != null || run.failed != null;
  if (!hasCounts) return t('runs.noCounts');
  return `${num(run.passed ?? 0)} OK / ${num(run.failed ?? 0)} Fail`;
}

function runTimestamp(run) {
  const parsed = run && run.startedAt ? Date.parse(run.startedAt) : NaN;
  return Number.isFinite(parsed) ? parsed : ((run && run.mtime) || 0);
}

function buildRunGroups(runs, currentPath, kind) {
  const map = new Map();
  for (const run of runs) {
    const key = runGroupKey(run);
    if (!map.has(key)) map.set(key, { key, runs: [] });
    map.get(key).runs.push(run);
  }

  const groups = [];
  for (const group of map.values()) {
    group.runs.sort((a, b) => runTimestamp(b) - runTimestamp(a));
    const chronological = [...group.runs].sort((a, b) => runTimestamp(a) - runTimestamp(b));
    const ordinals = new Map();
    chronological.forEach((run, index) => ordinals.set(run, index + 1));
    group.runs = group.runs.map((run) => ({ ...run, ordinal: ordinals.get(run) }));
    group.count = group.runs.length;
    group.latest = group.runs[0];
    group.current = Boolean(currentPath && group.runs.some((run) => run.reportPath === currentPath));
    groups.push(group);
  }

  groups.sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    return runTimestamp(b.latest) - runTimestamp(a.latest);
  });
  return groups;
}

function renderHistoryList(runs, currentPath, listSelector, emptySelector, countSelector, kind) {
  const list = $(listSelector);
  if (!list) return;

  const groups = buildRunGroups(runs, currentPath, kind);
  const countEl = $(countSelector);
  if (countEl) countEl.textContent = num(runs.length);

  if (groups.length === 0) {
    list.innerHTML = '';
    state.activeRunGroup[kind] = null;
    const empty = $(emptySelector);
    if (empty) empty.hidden = false;
    return;
  }
  const empty = $(emptySelector);
  if (empty) empty.hidden = true;

  const activeKey = (() => {
    const selectedPath = state.selectedRun[kind];
    if (selectedPath) {
      const selectedGroup = groups.find((group) => group.runs.some((run) => run.reportPath === selectedPath));
      if (selectedGroup) return selectedGroup.key;
    }
    return (groups.find((group) => group.current) || groups[0]).key;
  })();
  if (state.activeRunGroup[kind] !== activeKey) {
    state.activeRunGroup[kind] = activeKey;
    state.expandedRunGroups[kind][activeKey] = true;
  } else if (state.selectedRun[kind]) {
    state.expandedRunGroups[kind][activeKey] = true;
  }

  list.innerHTML = groups.map((group) => runGroupHtml(group, currentPath, kind)).join('');

  list.querySelectorAll('details.url-group').forEach((details) => {
    details.addEventListener('toggle', () => {
      const key = details.dataset.groupKey;
      if (!key) return;
      state.expandedRunGroups[kind][key] = details.open;
    });
  });
}

function runGroupHtml(group, currentPath, kind) {
  const open = Boolean(state.expandedRunGroups[kind] && state.expandedRunGroups[kind][group.key]);
  const label = group.key === 'sin-url' ? t('runs.group.noUrl') : group.key;
  const latest = group.latest;
  const dotClass = latest.failed == null ? 'run' : (Number(latest.failed) > 0 ? 'fail' : 'ok');
  const latestCounts = runCounts(latest);
  const activeBadge = group.current ? ` <span class="badge ok">${t('runs.current')}</span>` : '';

  return `
    <details class="url-group" data-group-key="${esc(group.key)}"${open ? ' open' : ''}>
      <summary class="url-group-head">
        <span class="url-group-dot ${dotClass}" aria-hidden="true"></span>
        <span class="url-group-main">
          <span class="url-group-name">${esc(label)}${activeBadge}</span>
          <span class="url-group-meta">${esc(groupCountLabel(kind, group.count))} · ${esc(latestCounts)}</span>
        </span>
        <span class="url-group-chevron" aria-hidden="true">▾</span>
      </summary>
      <div class="url-group-runs">
        ${group.runs.map((run) => runItemHtml(run, currentPath, kind)).join('')}
      </div>
    </details>`;
}

function runItemHtml(run, currentPath, kind) {
  const selected = state.selectedRun[kind] === run.reportPath;
  const current = Boolean(currentPath && run.reportPath === currentPath);
  const active = selected || (!state.selectedRun[kind] && current);
  const numberKey = kind === 'cucumber' ? 'runs.reportNumber' : 'runs.executionNumber';
  const title = t(numberKey, { n: run.ordinal });
  const counts = runCounts(run);
  const pages = run.pages != null ? ` · ${esc(run.pages)} ${t('runs.pagesShort')}` : '';

  return `
    <div class="history-item${active ? ' active' : ''}">
      <button type="button" class="history-select" data-run-select="${esc(run.reportPath)}">
        <span class="history-main">
          <span class="history-title">${esc(title)}${current ? ` <span class="badge ok">${t('runs.current')}</span>` : ''}</span>
          <span class="history-date">${esc(fmtDateShort(runTimestamp(run)))}</span>
          <span class="history-meta">${esc(counts)}${pages}</span>
        </span>
      </button>
      <button type="button" class="history-delete" data-run-delete="${esc(run.reportPath)}"
        title="${esc(t('runs.delete'))}" aria-label="${esc(t('runs.delete'))}">✕</button>
    </div>`;
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
 * Acerca de / Glosario
 * ------------------------------------------------------------------ */
function renderAbout() {
  const container = $('#about-content');
  if (!container) return;
  const data = ABOUT[state.lang] || ABOUT.es;

  $$('[data-about-tab]').forEach((button) => {
    const active = button.dataset.aboutTab === state.aboutTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  if (state.aboutTab === 'glossary') {
    container.innerHTML = `
      <div class="card about-card">
        <div class="about-head">
          <h3>${esc(data.glossaryTitle)}</h3>
          <p class="muted">${esc(data.glossarySubtitle)}</p>
        </div>
        <div class="glossary-grid">
          ${data.glossary.map((group) => `
            <section class="glossary-group" aria-label="${esc(group.title)}">
              <h4>${esc(group.title)}</h4>
              ${group.items.map((item) => `
                <details class="glossary-item">
                  <summary>
                    <span class="glossary-term">${esc(item.term)}</span>
                    <span class="glossary-chevron" aria-hidden="true">▾</span>
                  </summary>
                  <p>${esc(item.def)}</p>
                </details>`).join('')}
            </section>`).join('')}
        </div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="card about-card about-intro">
      <p>${esc(data.intro)}</p>
    </div>
    <div class="card about-card">
      <div class="about-head">
        <h3>${esc(data.howTitle)}</h3>
        <p class="muted">${esc(data.howSubtitle)}</p>
      </div>
      <ol class="about-steps">
        ${data.steps.map((step, index) => `
          <li class="about-step">
            <span class="about-step-number" aria-hidden="true">${index + 1}</span>
            <div>
              <strong>${esc(step.title)}</strong>
              <p>${esc(step.text)}</p>
            </div>
          </li>`).join('')}
      </ol>
    </div>
    <div class="card about-card">
      <div class="about-head">
        <h3>${esc(data.techTitle)}</h3>
        <p class="muted">${esc(data.techSubtitle)}</p>
      </div>
      <div class="tech-grid">
        ${data.tech.map((tech) => `
          <article class="tech-card">
            <div class="tech-card-head">
              <strong>${esc(tech.name)}</strong>
              <span class="badge ${tech.current ? 'ok' : ''}">${esc(tech.current ? data.current : data.planned)}</span>
            </div>
            <p class="muted">${esc(tech.text)}</p>
          </article>`).join('')}
      </div>
    </div>`;
}

function setAboutTab(name) {
  state.aboutTab = name === 'glossary' ? 'glossary' : 'how';
  renderAbout();
}

/* ------------------------------------------------------------------ *
 * GitHub Actions
 * ------------------------------------------------------------------ */

function ciStatusValue(run) {
  return String((run && (run.conclusion || run.status)) || '');
}

function ciStatusLabel(run) {
  const value = ciStatusValue(run);
  if (value === 'success') return t('ci.status.success');
  if (value === 'failure') return t('ci.status.failure');
  if (value === 'cancelled') return t('ci.status.cancelled');
  if (value === 'in_progress') return t('ci.status.inProgress');
  if (value === 'queued') return t('ci.status.queued');
  return value || '—';
}

function ciStatusClass(run) {
  const value = ciStatusValue(run);
  if (value === 'success') return 'success';
  if (value === 'failure') return 'failure';
  if (value === 'cancelled') return 'cancelled';
  return '';
}

async function loadCiScan() {
  try {
    const res = await fetch('/api/scan?file=' + encodeURIComponent('scan-report/ci-scan.json'));
    if (!res.ok) {
      state.ci.scan = null;
      return;
    }
    const payload = await res.json();
    state.ci.scan = payload.data || null;
  } catch {
    state.ci.scan = null;
  }
}

function ciScanTypeLabel(meta) {
  const type = String(meta.elementType || '');
  const depth = Number(meta.depth);
  const maxPages = Number(meta.maxPages);
  if (String(meta.origin || '') === 'github-actions') {
    return t('scans.filter.automated');
  }
  if (type === 'links' && (!Number.isFinite(depth) || depth <= 1) && (!Number.isFinite(maxPages) || maxPages <= 50)) {
    return t('scans.filter.quick');
  }
  if (type === 'all' && ((Number.isFinite(depth) && depth >= 10) || (Number.isFinite(maxPages) && maxPages >= 99999))) {
    return t('scans.filter.full');
  }
  return t('scans.filter.custom');
}

function renderCiScan() {
  const body = $('#ci-scan-body');
  const badge = $('#ci-scan-badge');
  if (!body) return;

  const scan = state.ci.scan;
  if (!scan) {
    if (badge) badge.textContent = '';
    body.innerHTML = `<p class="empty">${esc(t('ci.scan.empty'))}</p>`;
    return;
  }

  const meta = scan.scanMeta || {};
  const pages = scan.totalPages != null ? scan.totalPages : '—';
  const links = scan.totalLinks != null ? scan.totalLinks : '—';
  const type = ciScanTypeLabel(meta);
  const depth = meta.depth != null ? meta.depth : '—';
  const date = scan.timestamp ? fmtDateShort(Date.parse(scan.timestamp)) : '—';
  const downloads = Array.isArray(scan.downloads) ? scan.downloads.length : 0;
  const invalid = Array.isArray(scan.invalidLinks) ? scan.invalidLinks.length : 0;
  if (badge) {
    badge.textContent = Number(pages) === 1
      ? t('ci.scan.onePage')
      : t('ci.scan.pagesCount', { n: num(pages) });
  }

  const stat = (label, value) => `
    <div class="ci-scan-stat">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>`;

  body.innerHTML = `
    <p class="ci-scan-url">${esc(scan.baseUrl || '—')}</p>
    <div class="ci-scan-grid">
      ${stat(t('ci.scan.pages'), num(pages))}
      ${stat(t('ci.scan.links'), num(links))}
      ${stat(t('ci.scan.type'), type)}
      ${stat(t('ci.scan.depth'), num(depth))}
      ${stat(t('ci.scan.date'), date)}
      ${downloads > 0 ? stat(t('ci.scan.downloads'), num(downloads)) : ''}
      ${invalid > 0 ? stat(t('ci.scan.invalid'), num(invalid)) : ''}
    </div>
    <div class="ci-run-actions">
      <button type="button" class="btn" data-ci-scan-view>${esc(t('ci.scan.view'))}</button>
    </div>`;
}

async function loadCiErrors(runId) {
  const config = state.ci.config || {};
  const importedRuns = config.importedRuns || [];
  const selectedId = runId || state.ci.selectedRunId || config.lastImportedRunId;
  const entry = importedRuns.find((item) => String(item.runId) === String(selectedId));
  state.ci.selectedRunId = entry ? String(entry.runId) : null;
  const paths = [entry && entry.reportPath, entry && entry.cucumberPath].filter(Boolean);
  state.ci.errors = [];
  if (paths.length === 0) return;

  state.ci.errorReportLoading = true;
  try {
    const responses = await Promise.all(paths.map(async (reportPath) => {
      const res = await fetch('/api/run?path=' + encodeURIComponent(reportPath));
      if (!res.ok) return null;
      return res.json();
    }));
    const errors = [];
    for (const detail of responses) {
      if (detail && Array.isArray(detail.errorsList)) errors.push(...detail.errorsList);
    }
    state.ci.errors = errors;
  } catch {
    state.ci.errors = [];
  } finally {
    state.ci.errorReportLoading = false;
  }
}

async function selectCiImported(runId) {
  await loadCiErrors(runId);
  renderCiErrors();
}

function renderCiImported() {
  const card = $('#ci-imported-card');
  const list = $('#ci-imported-list');
  const count = $('#ci-imported-count');
  if (!card || !list) return;
  const runs = (state.ci.config && state.ci.config.importedRuns) || [];
  card.hidden = runs.length === 0;
  if (count) count.textContent = num(runs.length);
  list.innerHTML = runs.map((entry) => {
    const date = entry.importedAt ? fmtDateShort(Date.parse(entry.importedAt)) : '—';
    const reportLink = entry.reportPath
      ? `<a class="btn" href="/${esc(entry.reportPath)}" target="_blank" rel="noopener">${esc(t('ci.imported.viewReport'))}</a>`
      : '';
    return `
      <article class="ci-run">
        <div class="ci-run-main">
          <div class="ci-run-title">#${esc(entry.runId)} · ${esc(date)}</div>
          <div class="ci-run-meta"><span>${esc(entry.scan || '—')}</span></div>
        </div>
        <div class="ci-run-actions">
          ${reportLink}
          <button type="button" class="btn" data-ci-imported-detail="${esc(entry.runId)}">${esc(t('ci.imported.detail'))}</button>
          <button type="button" class="btn" data-ci-scan-view="${esc(entry.scan || '')}" ${entry.scan ? '' : 'disabled'}>${esc(t('ci.imported.viewScan'))}</button>
          <button type="button" class="btn danger" data-ci-imported-delete="${esc(entry.runId)}">${esc(t('ci.imported.delete'))}</button>
        </div>
      </article>`;
  }).join('');
}

async function deleteCiImported(runId) {
  if (!runId) return;
  if (!window.confirm(t('ci.imported.delete') + ' #' + runId + '?')) return;
  try {
    const res = await fetch('/api/ci/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('ci.imported.delete'));
    if (String(state.ci.selectedRunId) === String(runId)) state.ci.selectedRunId = null;
    toast(t('ci.imported.deleted'));
    await Promise.all([loadCi(), loadOverview(), loadScans(), loadTests(), loadRuns()]);
  } catch (e) {
    toast(String(e && e.message ? e.message : e), true);
  }
}

function renderCiErrors() {
  const card = $('#ci-errors-card');
  if (!card) return;
  const config = state.ci.config || {};
  const selectedId = state.ci.selectedRunId || config.lastImportedRunId;
  if (!selectedId) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  const title = $('#ci-errors-title');
  if (title) title.textContent = `${t('ci.errors.title')} #${selectedId}`;
  renderErrorCards(
    state.ci.errors,
    $('#ci-errors-list'),
    $('#ci-errors-empty'),
    $('#ci-errors-count'),
    null,
    state.ci.errors.length
  );
}

function renderCi() {
  const configCard = $('#ci-config');
  const content = $('#ci-content');
  if (!configCard || !content) return;

  const cfg = state.ci.config || {};
  const configured = Boolean(cfg.configured);
  $('#ci-badge').textContent = configured
    ? (cfg.autoImport ? t('ci.auto') : t('ci.manual'))
    : t('ci.noConfig');

  configCard.hidden = configured;
  content.hidden = !configured;

  if (!configured) {
    $('#ci-config-text').textContent = t('ci.config.text');
    $('#ci-config-code').textContent = [
      'GITHUB_REPO=tu-usuario/CACHAI-QA',
      'GITHUB_TOKEN=github_pat_...',
      'GITHUB_CI_AUTO_IMPORT=true'
    ].join('\n');
    return;
  }

  $('#ci-repo').textContent = cfg.repo || '—';
  $('#ci-help').textContent = t('ci.help');

  const importButton = $('#ci-import');
  const latestSuccess = state.ci.runs.find((run) => ciStatusValue(run) === 'success');
  importButton.disabled = state.ci.importing || !latestSuccess;
  importButton.textContent = state.ci.importing ? t('ci.importing') : t('ci.import');
  const runButton = $('#ci-run-start');
  if (runButton) {
    runButton.disabled = state.ci.dispatching || state.ci.importing;
    runButton.textContent = state.ci.dispatching ? t('ci.run.waiting') : t('ci.run.start');
  }
  $('#ci-refresh').disabled = state.ci.loading || state.ci.importing;

  const list = $('#ci-runs');
  const empty = $('#ci-empty');
  if (state.ci.error) {
    list.innerHTML = '';
    empty.hidden = false;
    empty.textContent = state.ci.error;
  } else if (state.ci.runs.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    empty.textContent = t('ci.empty');
  } else {
    empty.hidden = true;
    list.innerHTML = state.ci.runs.map((run) => {
      const importedEntry = (cfg.importedRuns || []).find((item) => String(item.runId) === String(run.id));
      const imported = Boolean(importedEntry);
      const date = run.createdAt ? fmtDateShort(Date.parse(run.createdAt)) : '—';
      const status = ciStatusValue(run);
      const reportLink = importedEntry && importedEntry.reportPath
        ? `<a class="btn" href="/${esc(importedEntry.reportPath)}" target="_blank" rel="noopener">${esc(t('ci.imported.viewReport'))}</a>`
        : '';
      const importedActions = imported
        ? `${reportLink}
           <button type="button" class="btn" data-ci-imported-detail="${esc(importedEntry.runId)}">${esc(t('ci.imported.detail'))}</button>
           <button type="button" class="btn danger" data-ci-imported-delete="${esc(importedEntry.runId)}" title="${esc(t('ci.imported.delete'))}" aria-label="${esc(t('ci.imported.delete'))}">×</button>`
        : `<button type="button" class="btn ${status === 'success' ? 'primary' : ''}" data-ci-import="${esc(run.id)}" ${status !== 'success' || state.ci.importing ? 'disabled' : ''}>
             ${esc(t('ci.import.run'))}
           </button>`;
      return `
        <article class="ci-run ${imported ? 'is-imported' : ''}">
          <div class="ci-run-main">
            <div class="ci-run-title">
              <span class="ci-dot ${ciStatusClass(run)}" aria-hidden="true"></span>
              #${esc(num(run.runNumber))} · ${esc(run.name || 'CACHAI-QA')}
              ${imported ? `<span class="badge info">${esc(t('ci.imported'))}</span>` : ''}
            </div>
            <div class="ci-run-meta">
              <span>${esc(t('ci.branch'))}: ${esc(run.branch || '—')}</span>
              <span>${esc(date)}</span>
              <span>${esc(ciStatusLabel(run))}</span>
            </div>
          </div>
          <div class="ci-run-actions">
            ${run.htmlUrl ? `<a class="btn ghost" href="${esc(run.htmlUrl)}" target="_blank" rel="noopener">${esc(t('ci.open'))}</a>` : ''}
            ${importedActions}
          </div>
        </article>`;
    }).join('');
  }

  const last = $('#ci-last');
  const lastText = $('#ci-last-text');
  if (cfg.lastImportedRunId) {
    last.hidden = false;
    const date = cfg.lastImportedAt ? fmtDateShort(Date.parse(cfg.lastImportedAt)) : '—';
    lastText.textContent = t('ci.last.text', { id: cfg.lastImportedRunId, date });
  } else {
    last.hidden = false;
    lastText.textContent = t('ci.last.none');
  }

  renderCiScan();
  renderCiImported();
  renderCiErrors();
}

async function loadCi() {
  state.ci.loading = true;
  renderCi();
  try {
    const [configRes, runsRes] = await Promise.all([
      fetch('/api/ci/config'),
      fetch('/api/ci/runs'),
      loadCiScan()
    ]);
    const config = await configRes.json();
    const runsPayload = await runsRes.json();
    state.ci.config = config;
    state.ci.runs = Array.isArray(runsPayload.runs) ? runsPayload.runs : [];
    state.ci.error = runsPayload.error || '';
    await loadCiErrors();

    renderCi();

    if (config.configured && config.autoImport) {
      const latest = state.ci.runs.find((run) => ciStatusValue(run) === 'success');
      if (latest && String(latest.id) !== String(config.lastImportedRunId)) {
        await importCi(latest.id, true);
      }
    }
  } catch (e) {
    state.ci.error = String(e && e.message ? e.message : e);
    renderCi();
  } finally {
    state.ci.loading = false;
    renderCi();
  }
}

let ciRunPollTimer = null;

function loadCiForm() {
  try {
    const saved = JSON.parse(localStorage.getItem('cq.ciForm') || '{}');
    const values = {
      '#ci-run-scan-type': saved.scanType,
      '#ci-run-depth': saved.depth,
      '#ci-run-max-pages': saved.maxPages,
      '#ci-run-engine': saved.engine,
      '#ci-run-browsers': saved.browsers,
      '#ci-run-max-links': saved.maxLinks
    };
    for (const [selector, value] of Object.entries(values)) {
      const element = $(selector);
      if (element && value != null && value !== '') element.value = value;
    }
  } catch { /* preferencias inválidas */ }
}

function saveCiForm() {
  try {
    localStorage.setItem('cq.ciForm', JSON.stringify({
      scanType: $('#ci-run-scan-type').value,
      depth: $('#ci-run-depth').value,
      maxPages: $('#ci-run-max-pages').value,
      engine: $('#ci-run-engine').value,
      browsers: $('#ci-run-browsers').value,
      maxLinks: $('#ci-run-max-links').value
    }));
  } catch { /* almacenamiento no disponible */ }
}

async function startCiRun() {
  const input = $('#ci-run-url');
  const status = $('#ci-run-status');
  const url = input ? input.value.trim() : '';
  if (!/^https?:\/\/[^\s]+$/i.test(url)) {
    toast(t('scans.create.invalid'), true);
    return;
  }
  if (state.ci.dispatching) return;

  state.ci.dispatching = true;
  renderCi();
  if (status) status.textContent = t('ci.run.dispatching');
  const progressWrap = $('#ci-run-progress-wrap');
  const progress = $('#ci-run-progress');
  const progressLabel = $('#ci-run-progress-label');
  if (progressWrap && progress) {
    progressWrap.hidden = false;
    progress.value = 10;
    if (progressLabel) progressLabel.textContent = t('ci.run.dispatching');
  }

  const knownIds = new Set(state.ci.runs.map((run) => String(run.id)));
  const scanType = ($('#ci-run-scan-type') && $('#ci-run-scan-type').value) || 'all';
  const depth = Number($('#ci-run-depth') && $('#ci-run-depth').value);
  const maxPages = Number($('#ci-run-max-pages') && $('#ci-run-max-pages').value);
  const engine = ($('#ci-run-engine') && $('#ci-run-engine').value) || 'both';
  const browsers = ($('#ci-run-browsers') && $('#ci-run-browsers').value) || 'chromium';
  const maxLinks = Number($('#ci-run-max-links') && $('#ci-run-max-links').value);
  saveCiForm();
  try {
    const res = await fetch('/api/ci/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, scanType, depth, maxPages, engine, browsers, maxLinks })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('ci.run.error'));
    toast(t('ci.run.sent'));
    if (status) status.textContent = t('ci.run.waiting');
    pollCiRun(knownIds, 0);
  } catch (e) {
    state.ci.dispatching = false;
    renderCi();
    if (status) status.textContent = '';
    const progressWrap = $('#ci-run-progress-wrap');
    if (progressWrap) progressWrap.hidden = true;
    toast(String(e && e.message ? e.message : t('ci.run.error')), true);
  }
}

async function pollCiRun(knownIds, attempt) {
  clearTimeout(ciRunPollTimer);
  ciRunPollTimer = null;
  if (attempt > 120) {
    state.ci.dispatching = false;
    renderCi();
    toast(t('ci.run.error'), true);
    return;
  }

  await loadCi();
  const newRun = state.ci.runs.find((run) => !knownIds.has(String(run.id)));
  const status = $('#ci-run-status');
  const progress = $('#ci-run-progress');
  const progressLabel = $('#ci-run-progress-label');
  if (newRun) {
    if (status) status.textContent = `${t('ci.run.waiting')} #${newRun.runNumber || newRun.id}`;
    if (progress) progress.value = newRun.status === 'completed' ? 100 : 50;
    if (progressLabel) progressLabel.textContent = newRun.status === 'completed' ? t('ci.run.done') : t('ci.run.waiting');
    if (newRun.status === 'completed') {
      state.ci.dispatching = false;
      renderCi();
      if (status) status.textContent = t('ci.run.done');
      toast(t('ci.run.done'));
      return;
    }
  } else {
    if (progress) progress.value = 20;
    if (progressLabel) progressLabel.textContent = t('ci.run.waiting');
  }

  ciRunPollTimer = setTimeout(() => pollCiRun(knownIds, attempt + 1), 10000);
}

async function importCi(runId, silent) {
  if (!runId || state.ci.importing) return;
  state.ci.importing = true;
  renderCi();

  try {
    const res = await fetch('/api/ci/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('ci.import.error'));

    state.ci.selectedRunId = String(data.runId);
    await Promise.all([loadOverview(), loadScans(), loadTests(), loadRuns(), loadCiScan()]);
    toast(t('ci.import.ok'));
    await loadCi();
  } catch (e) {
    toast(String(e && e.message ? e.message : t('ci.import.error')), true);
  } finally {
    state.ci.importing = false;
    renderCi();
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
  if (name === 'about') renderAbout();
  if (name === 'ci') loadCi();
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
  $$('[data-about-tab]').forEach((button) => button.addEventListener('click', () => setAboutTab(button.dataset.aboutTab)));

  $('#refresh').addEventListener('click', async () => {
    await Promise.all([loadOverview(), loadScans(), loadTests(), loadRuns(), loadCi(), loadBrowserStack()]);
    toast(t('toast.refreshed'));
  });

  $('#scan-start').addEventListener('click', startScan);
  $('#scan-cancel').addEventListener('click', cancelScan);
  $('#scan-mode').addEventListener('change', syncScanMode);
  $('#scan-url').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      startScan();
    }
  });

  $('#ci-refresh').addEventListener('click', loadCi);
  $('#ci-run-start').addEventListener('click', startCiRun);
  $('#ci-run-url').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      startCiRun();
    }
  });
  $('#ci-import').addEventListener('click', () => {
    const latest = state.ci.runs.find((run) => ciStatusValue(run) === 'success');
    if (latest) importCi(latest.id, false);
  });
  $('#ci-runs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-ci-import]');
    if (button) importCi(button.dataset.ciImport, false);
  });

  $('#scans-list').addEventListener('click', (event) => {
    const favorite = event.target.closest('[data-favorite]');
    const view = event.target.closest('[data-view]');
    const del = event.target.closest('[data-delete]');
    if (favorite) toggleFavorite(favorite.dataset.favorite);
    if (view) openScan(view.dataset.view);
    if (del) deleteScan(del.dataset.delete);
  });

  ['#runs-list-playwright', '#runs-list-cucumber'].forEach((selector) => {
    const list = $(selector);
    if (!list) return;
    const kind = selector.includes('playwright') ? 'playwright' : 'cucumber';
    list.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-run-delete]');
      if (remove) {
        deleteRun(kind, remove.dataset.runDelete);
        return;
      }
      const item = event.target.closest('[data-run-select]');
      if (item) selectRun(kind, item.dataset.runSelect);
    });
  });

  const browserstackList = $('#runs-list-browserstack');
  if (browserstackList) {
    browserstackList.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-browserstack-delete]');
      if (remove) deleteRun('playwright', remove.dataset.browserstackDelete);
    });
  }

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
    const ciScan = event.target.closest('[data-ci-scan-view]');
    if (ciScan) openScan(ciScan.dataset.ciScanView || 'scan-report/ci-scan.json');
    const ciDetail = event.target.closest('[data-ci-imported-detail]');
    if (ciDetail) selectCiImported(ciDetail.dataset.ciImportedDetail);
    const ciDelete = event.target.closest('[data-ci-imported-delete]');
    if (ciDelete) deleteCiImported(ciDelete.dataset.ciImportedDelete);
    const latest = event.target.closest('[data-run-latest]');
    if (latest) clearSelectedRun(latest.dataset.runLatest);
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
  syncScanMode();
  loadCiForm();
  applyLang();
  setScanFilter(state.scanFilter);
  setRunFilter(state.runFilter);
  Promise.all([loadOverview(), loadScans(), loadTests(), loadRuns(), loadCi(), loadScanJob(), loadBrowserStack()]);
}

init();
