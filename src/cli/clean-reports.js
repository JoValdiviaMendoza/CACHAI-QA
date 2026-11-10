#!/usr/bin/env node
'use strict';

/**
 * CACHAI-QA - Limpieza de reportes antiguos
 *
 * Conserva las N ejecuciones más recientes de cada categoría y elimina las
 * anteriores. Por defecto solo muestra qué haría (dry-run); para borrar hay
 * que indicar --apply.
 *
 * Uso:
 *   node cli/clean-reports.js --keep=10
 *   node cli/clean-reports.js --keep=10 --apply
 *   node cli/clean-reports.js --keep=5 --apply --reports-dir=reports
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = {
    keep: 10,
    apply: false,
    reportsDir: path.join(ROOT, 'reports'),
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') {
      opts.apply = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }
    if (arg === '--keep') {
      opts.keep = Number(argv[++i]);
      continue;
    }
    if (arg.startsWith('--keep=')) {
      opts.keep = Number(arg.slice('--keep='.length));
      continue;
    }
    if (arg === '--reports-dir') {
      const value = argv[++i] || '';
      opts.reportsDir = path.isAbsolute(value) ? value : path.resolve(ROOT, value);
      continue;
    }
    if (arg.startsWith('--reports-dir=')) {
      const value = arg.slice('--reports-dir='.length);
      opts.reportsDir = path.isAbsolute(value) ? value : path.resolve(ROOT, value);
    }
  }

  if (!Number.isFinite(opts.keep) || opts.keep < 1) {
    console.warn('[LIMPIEZA] --keep debe ser un número mayor o igual a 1. Se usará 10.');
    opts.keep = 10;
  }
  opts.keep = Math.floor(opts.keep);
  return opts;
}

function usage() {
  console.log('');
  console.log('Uso: node cli/clean-reports.js [--keep=N] [--apply] [--reports-dir=ruta]');
  console.log('');
  console.log('  --keep=N          Ejecuciones a conservar por categoría (por defecto 10).');
  console.log('  --apply           Elimina los archivos. Sin esta opción solo muestra el plan.');
  console.log('  --reports-dir=... Carpeta de reportes (por defecto src/reports).');
  console.log('');
  console.log('Categorías:');
  console.log('  - reports/playwright-report-*');
  console.log('  - reports/defectos-*.md');
  console.log('  - reports/cucumber/cucumber-report-<fecha>.(html|json)');
  console.log('  - reports/<host>-<fecha>.json (resúmenes de ejecución)');
  console.log('');
  console.log('No elimina: results.json, bdd-metrics.json, cucumber-report.html/json');
  console.log('ni la carpeta reports/generated-tests.');
}

function statSafe(full) {
  try {
    return fs.statSync(full);
  } catch {
    return null;
  }
}

function dirSize(dir) {
  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(full);
    else if (entry.isFile()) {
      const st = statSafe(full);
      if (st) total += st.size;
    }
  }
  return total;
}

function stampOf(name) {
  const match = String(name).match(/(\d{8}-\d{6})/);
  return match ? match[1] : '';
}

function sortByStamp(items) {
  return items.sort((a, b) => {
    if (a.stamp && b.stamp && a.stamp !== b.stamp) return b.stamp.localeCompare(a.stamp);
    return b.mtime - a.mtime;
  });
}

function itemOf(full, name, kind) {
  const st = statSafe(full);
  return {
    full,
    name,
    kind,
    stamp: stampOf(name),
    mtime: st ? st.mtimeMs : 0,
    size: kind === 'dir' ? dirSize(full) : (st ? st.size : 0)
  };
}

function listPlaywright(reportsDir) {
  let entries;
  try {
    entries = fs.readdirSync(reportsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory() && /^playwright-report-/i.test(entry.name))
    .map((entry) => itemOf(path.join(reportsDir, entry.name), entry.name, 'dir'));
}

function listDefects(reportsDir) {
  let entries;
  try {
    entries = fs.readdirSync(reportsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && /^defectos-.*\.md$/i.test(entry.name))
    .map((entry) => itemOf(path.join(reportsDir, entry.name), entry.name, 'file'));
}

function listCucumber(reportsDir) {
  const cucumberDir = path.join(reportsDir, 'cucumber');
  let entries;
  try {
    entries = fs.readdirSync(cucumberDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && /^cucumber-report-\d{8}-\d{6}\.html$/i.test(entry.name))
    .map((entry) => {
      const html = path.join(cucumberDir, entry.name);
      const json = path.join(cucumberDir, entry.name.replace(/\.html$/i, '.json'));
      const item = itemOf(html, entry.name, 'file');
      item.files = [html];
      item.size += itemOf(json, path.basename(json), 'file').size;
      if (fs.existsSync(json)) item.files.push(json);
      return item;
    });
}

function listSummaries(reportsDir) {
  let entries;
  try {
    entries = fs.readdirSync(reportsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile()
      && /^.+-\d{8}-\d{6}\.json$/i.test(entry.name)
      && !/^defectos-/i.test(entry.name))
    .map((entry) => itemOf(path.join(reportsDir, entry.name), entry.name, 'file'));
}

function humanSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function removeItem(item) {
  if (item.kind === 'dir') {
    fs.rmSync(item.full, { recursive: true, force: true });
    return;
  }
  for (const file of item.files || [item.full]) {
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
  }
}

function processCategory(label, items, opts, results) {
  const sorted = sortByStamp(items.slice());
  const keep = sorted.slice(0, opts.keep);
  const remove = sorted.slice(opts.keep);
  let freed = 0;
  let errors = 0;

  for (const item of remove) {
    freed += item.size;
    if (opts.apply) {
      try {
        removeItem(item);
      } catch (error) {
        errors += 1;
        console.error(`[ERROR] No se pudo eliminar ${item.name}: ${error.message}`);
      }
    }
  }

  results.push({
    label,
    total: sorted.length,
    kept: keep.length,
    removed: remove.length,
    freed,
    errors,
    remove: remove.slice(0, 10)
  });
}

function printResults(results, opts) {
  console.log('');
  console.log('=== LIMPIEZA DE REPORTES ===');
  console.log(`Carpeta:  ${opts.reportsDir}`);
  console.log(`Modo:     ${opts.apply ? 'APLICAR (elimina archivos)' : 'SIMULACIÓN (no elimina archivos)'}`);
  console.log(`Conservar: ${opts.keep} por categoría`);
  console.log('');
  console.log('| Categoría | Total | Conservados | A eliminar | Espacio |');
  console.log('|---|---|---|---|---|');

  let totalRemoved = 0;
  let totalFreed = 0;
  let totalErrors = 0;
  for (const result of results) {
    totalRemoved += result.removed;
    totalFreed += result.freed;
    totalErrors += result.errors;
    console.log(`| ${result.label} | ${result.total} | ${result.kept} | ${result.removed} | ${humanSize(result.freed)} |`);
  }
  console.log('');

  if (!opts.apply) {
    for (const result of results) {
      if (result.remove.length === 0) continue;
      console.log(`${result.label} — se eliminarían:`);
      for (const item of result.remove) console.log(`  - ${item.name}`);
      if (result.removed > result.remove.length) {
        console.log(`  ... y ${result.removed - result.remove.length} más.`);
      }
      console.log('');
    }
    console.log('No se eliminó ningún archivo. Ejecuta de nuevo con --apply para aplicar el cambio.');
  } else {
    console.log(`Eliminados: ${totalRemoved} elementos. Espacio liberado: ${humanSize(totalFreed)}.`);
    if (totalErrors > 0) console.log(`Errores: ${totalErrors}. Revisa los mensajes anteriores.`);
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }

  if (!fs.existsSync(opts.reportsDir)) {
    console.error(`[LIMPIEZA] No existe la carpeta: ${opts.reportsDir}`);
    process.exitCode = 1;
    return;
  }

  const results = [];
  processCategory('Reportes Playwright', listPlaywright(opts.reportsDir), opts, results);
  processCategory('Defectos Markdown', listDefects(opts.reportsDir), opts, results);
  processCategory('Reportes Cucumber fechados', listCucumber(opts.reportsDir), opts, results);
  processCategory('Resúmenes de ejecución', listSummaries(opts.reportsDir), opts, results);

  printResults(results, opts);
}

main();
