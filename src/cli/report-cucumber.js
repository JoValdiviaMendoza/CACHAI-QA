#!/usr/bin/env node
'use strict';

/**
 * CACHAI-QA - Resume el reporte JSON de Cucumber y lo deja listo para el panel.
 *
 * Genera:
 *   - reports/bdd-metrics.json                     (métricas para el dashboard)
 *   - reports/cucumber/cucumber-report-<fecha>.html (historial de ejecuciones)
 *   - reports/cucumber/cucumber-report-<fecha>.json (datos de esa ejecución)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'reports', 'cucumber');
const JSON_REPORT = path.join(REPORT_DIR, 'cucumber-report.json');
const HTML_REPORT = path.join(REPORT_DIR, 'cucumber-report.html');

function pad(value) {
  return String(value).padStart(2, '0');
}

function slug(date) {
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    '-' +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

function readJson(file) {
  let text = fs.readFileSync(file, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return JSON.parse(text);
}

function totalsOf(features) {
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

  for (const feature of features) {
    for (const element of feature.elements || []) {
      if (element.type !== 'scenario') continue;
      totals.totalScenarios += 1;
      let scenarioStatus = 'passed';
      for (const step of element.steps || []) {
        const status = (step.result && step.result.status) || 'undefined';

        // Cucumber agrega los hooks Before/After como pasos ocultos.
        // No se cuentan como pasos de lenguaje natural, pero un hook fallido
        // sí debe marcar el escenario como fallido.
        if (step.hidden) {
          if (status === 'failed') scenarioStatus = 'failed';
          continue;
        }

        totals.totalSteps += 1;
        if (status === 'passed') totals.passed += 1;
        else if (status === 'failed') {
          totals.failed += 1;
          scenarioStatus = 'failed';
        } else if (status === 'skipped' || status === 'pending') {
          totals.skipped += 1;
          if (scenarioStatus === 'passed') scenarioStatus = 'skipped';
        } else {
          totals.undefined += 1;
          if (scenarioStatus !== 'failed') scenarioStatus = 'undefined';
        }
      }
      if (scenarioStatus === 'passed') totals.scenariosPassed += 1;
      else if (scenarioStatus === 'failed') totals.scenariosFailed += 1;
      else totals.scenariosSkipped += 1;
    }
  }

  return totals;
}

function main() {
  if (!fs.existsSync(JSON_REPORT)) {
    console.log('[BDD] No se encontró el reporte JSON de Cucumber: reports/cucumber/cucumber-report.json');
    console.log('[BDD] Ejecuta primero Cucumber con la opción [4] del menú.');
    return;
  }

  const stats = fs.statSync(JSON_REPORT);
  if (!stats.size || stats.size <= 2) {
    console.log('[BDD] Cucumber no generó resultados válidos (reporte vacío o interrumpido).');
    console.log('[BDD] No se actualizó el historial para evitar guardar una ejecución incompleta.');
    return;
  }

  let features;
  try {
    features = readJson(JSON_REPORT);
  } catch (error) {
    console.log('[BDD] No se pudo leer el reporte JSON de Cucumber: ' + error.message);
    console.log('[BDD] No se actualizó el historial para evitar guardar una ejecución incompleta.');
    return;
  }

  if (!Array.isArray(features)) {
    console.log('[BDD] El reporte de Cucumber no tiene el formato esperado.');
    return;
  }

  const totals = totalsOf(features);
  const metrics = {
    ...totals,
    generatedAt: new Date().toISOString(),
    report: 'reports/cucumber/cucumber-report.html'
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'reports', 'bdd-metrics.json'), JSON.stringify(metrics, null, 2), 'utf8');

  // Copia fechada para que el panel muestre cada ejecución en "Ejecuciones".
  const stamp = slug(new Date());
  if (fs.existsSync(HTML_REPORT)) {
    fs.copyFileSync(HTML_REPORT, path.join(REPORT_DIR, 'cucumber-report-' + stamp + '.html'));
  }
  fs.copyFileSync(JSON_REPORT, path.join(REPORT_DIR, 'cucumber-report-' + stamp + '.json'));

  console.log('');
  console.log('=== RESUMEN BDD (Cucumber) ===');
  console.log('Features:           ' + totals.totalFeatures);
  console.log('Escenarios:         ' + totals.totalScenarios);
  console.log('  OK:               ' + totals.scenariosPassed);
  console.log('  Fallidos:         ' + totals.scenariosFailed);
  console.log('  Omitidos:         ' + totals.scenariosSkipped);
  console.log('Pasos:              ' + totals.totalSteps);
  console.log('  OK:               ' + totals.passed);
  console.log('  Fallidos:         ' + totals.failed);
  console.log('  Omitidos:         ' + totals.skipped);
  console.log('  Sin definir:      ' + totals.undefined);
  console.log('Reporte:     reports/cucumber/cucumber-report.html');
  console.log('Historial:   reports/cucumber/cucumber-report-' + stamp + '.html');
  console.log('');
}

main();
