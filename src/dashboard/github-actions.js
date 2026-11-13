'use strict';

/**
 * Integración mínima con GitHub Actions para el dashboard local.
 *
 * - Lista ejecuciones del workflow.
 * - Descarga los artefactos scan/reports de una ejecución.
 * - Extrae el ZIP sin dependencias externas.
 * - Copia los archivos al formato que ya consume el dashboard.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const API = 'https://api.github.com';
const DEFAULT_WORKFLOW = 'qa.yml';

function createGithubActions(options) {
  const root = options.root;
  const repo = String(options.repo || '').trim();
  const token = String(options.token || '').trim();
  const workflow = String(options.workflow || DEFAULT_WORKFLOW).trim() || DEFAULT_WORKFLOW;
  const ref = String(options.ref || 'main').trim() || 'main';
  const autoImport = Boolean(options.autoImport);
  const stateFile = path.join(root, 'reports', '.github-actions-state.json');

  function configured() {
    return Boolean(repo && token);
  }

  function state() {
    try {
      return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    } catch {
      return {};
    }
  }

  function saveState(next) {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(next, null, 2));
  }

  function publicConfig() {
    const current = state();
    return {
      configured: configured(),
      hasToken: Boolean(token),
      repo,
      workflow,
      ref,
      autoImport,
      lastImportedRunId: current.lastImportedRunId || null,
      lastImportedAt: current.lastImportedAt || null,
      importedRuns: Array.isArray(current.importedRuns) ? current.importedRuns : []
    };
  }

  function headers() {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'User-Agent': 'CACHAI-QA-Dashboard',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  async function apiJson(url) {
    const res = await fetch(url, { headers: headers(), cache: 'no-store' });
    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch { /* ignore */ }
      throw new Error(`GitHub API ${res.status}: ${detail.slice(0, 180)}`);
    }
    return res.json();
  }

  async function listRuns() {
    if (!configured()) throw new Error('Configura GITHUB_REPO y GITHUB_TOKEN en src/.env.');
    const url = `${API}/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=15`;
    const data = await apiJson(url);
    return (data.workflow_runs || []).map((run) => ({
      id: run.id,
      name: run.name || 'CACHAI-QA QA Pipeline',
      runNumber: run.run_number,
      branch: run.head_branch || '',
      event: run.event || '',
      status: run.status || '',
      conclusion: run.conclusion || '',
      createdAt: run.created_at || '',
      updatedAt: run.updated_at || '',
      htmlUrl: run.html_url || ''
    }));
  }

  async function listArtifacts(runId) {
    const data = await apiJson(`${API}/repos/${repo}/actions/runs/${runId}/artifacts`);
    return data.artifacts || [];
  }

  async function dispatchRun(targetUrl, options = {}) {
    if (!configured()) throw new Error('Configura GITHUB_REPO y GITHUB_TOKEN en src/.env.');
    const url = `${API}/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;
    const allowedScanTypes = ['all', 'links', 'images', 'forms', 'buttons'];
    const allowedEngines = ['playwright', 'cucumber', 'both'];
    const allowedBrowsers = ['chromium', 'chromium,firefox'];
    const scanType = allowedScanTypes.includes(options.scanType) ? options.scanType : 'all';
    const engine = allowedEngines.includes(options.engine) ? options.engine : 'both';
    const browsers = allowedBrowsers.includes(options.browsers) ? options.browsers : 'chromium';
    const depth = Math.max(0, Math.min(9999, Math.floor(Number(options.depth) || 999)));
    const maxPages = Math.max(1, Math.min(999999, Math.floor(Number(options.maxPages) || 999999)));
    const maxLinks = Math.max(1, Math.min(500, Math.floor(Number(options.maxLinks) || 40)));
    const inputs = {
      target_url: String(targetUrl || '').trim(),
      max_pages: String(maxPages),
      depth: String(depth),
      scan_type: scanType,
      engine,
      browsers,
      max_links: String(maxLinks),
      fail_on_defects: 'false'
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ref, inputs })
    });
    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch { /* ignore */ }
      throw new Error(`GitHub no aceptó la ejecución (${res.status}): ${detail.slice(0, 180)}`);
    }
    return { ok: true, ref, inputs };
  }

  async function downloadArtifact(artifactId) {
    const url = `${API}/repos/${repo}/actions/artifacts/${artifactId}/zip`;
    let res = await fetch(url, { headers: headers(), redirect: 'manual' });

    // GitHub responde con un redirect firmado. No se debe enviar el token
    // al dominio de descarga, así que se sigue sin Authorization.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new Error('GitHub no entregó la URL de descarga del artefacto.');
      res = await fetch(location);
    }

    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch { /* ignore */ }
      throw new Error(`No se pudo descargar el artefacto (${res.status}): ${detail.slice(0, 160)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  function readZipEntries(buffer) {
    let eocd = -1;
    const min = Math.max(0, buffer.length - 65557);
    for (let i = buffer.length - 22; i >= min; i--) {
      if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('El artefacto no es un ZIP válido.');

    const total = buffer.readUInt16LE(eocd + 10);
    let ptr = buffer.readUInt32LE(eocd + 16);
    const entries = [];

    for (let index = 0; index < total; index++) {
      if (ptr + 46 > buffer.length || buffer.readUInt32LE(ptr) !== 0x02014b50) break;
      const method = buffer.readUInt16LE(ptr + 10);
      const compressedSize = buffer.readUInt32LE(ptr + 20);
      const nameLength = buffer.readUInt16LE(ptr + 28);
      const extraLength = buffer.readUInt16LE(ptr + 30);
      const commentLength = buffer.readUInt16LE(ptr + 32);
      const localOffset = buffer.readUInt32LE(ptr + 42);
      const name = buffer.toString('utf8', ptr + 46, ptr + 46 + nameLength);
      entries.push({ name, method, compressedSize, localOffset });
      ptr += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }

  function extractZip(buffer, targetDir) {
    const entries = readZipEntries(buffer);
    fs.mkdirSync(targetDir, { recursive: true });

    for (const entry of entries) {
      const safeName = String(entry.name || '').replace(/\\/g, '/');
      if (!safeName || safeName.endsWith('/')) continue;
      if (safeName.startsWith('/') || safeName.split('/').includes('..')) continue;

      const local = entry.localOffset;
      if (local + 30 > buffer.length) continue;
      const nameLength = buffer.readUInt16LE(local + 26);
      const extraLength = buffer.readUInt16LE(local + 28);
      const dataStart = local + 30 + nameLength + extraLength;
      const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);
      let data;
      if (entry.method === 0) data = Buffer.from(compressed);
      else if (entry.method === 8) data = zlib.inflateRawSync(compressed);
      else continue;

      const full = path.resolve(targetDir, safeName);
      if (full !== targetDir && !full.startsWith(targetDir + path.sep)) continue;
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, data);
    }
  }

  function hostSlug(value) {
    try {
      const host = new URL(value).hostname.replace(/^www\./i, '').replace(/[^a-z0-9.-]/gi, '-');
      return host || 'sitio';
    } catch {
      return 'sitio';
    }
  }

  function findFile(dir, name) {
    if (!fs.existsSync(dir)) return null;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = findFile(full, name);
        if (nested) return nested;
      } else if (entry.name === name) {
        return full;
      }
    }
    return null;
  }

  function reportPathsFromSource(source) {
    const entries = fs.readdirSync(source);
    const playwrightDir = entries
      .filter((name) => name.startsWith('playwright-report-'))
      .sort()
      .pop();
    const cucumberHtml = findFile(source, 'cucumber-report.html');
    const defectFile = entries
      .filter((name) => /^defectos-.*\.md$/i.test(name))
      .sort()
      .pop();
    let summaryPath = null;
    for (const name of entries.filter((item) => item.toLowerCase().endsWith('.json'))) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(source, name), 'utf8'));
        if (data && data.metadata) {
          summaryPath = 'reports/' + name;
          break;
        }
      } catch { /* no es un resumen */ }
    }

    return {
      reportPath: playwrightDir
        ? 'reports/' + path.posix.join(playwrightDir, 'index.html')
        : null,
      cucumberPath: cucumberHtml
        ? 'reports/' + path.relative(source, cucumberHtml).replace(/\\/g, '/')
        : null,
      defectPath: defectFile ? 'reports/' + defectFile : null,
      summaryPath
    };
  }

  function copyReports(extractedRoot, scanRel, runId) {
    const nested = path.join(extractedRoot, 'reports');
    const source = fs.existsSync(nested) ? nested : extractedRoot;
    const target = path.join(root, 'reports');
    fs.mkdirSync(target, { recursive: true });

    // Los resúmenes del dashboard deben apuntar al scan único de esta
    // ejecución, no al ci-scan.json que se sobrescribía antes.
    for (const name of fs.readdirSync(source)) {
      if (!name.toLowerCase().endsWith('.json')) continue;
      const full = path.join(source, name);
      try {
        const data = JSON.parse(fs.readFileSync(full, 'utf8'));
        if (!data || !data.metadata || typeof data.metadata !== 'object') continue;
        data.metadata.scanSource = scanRel;
        data.metadata.origin = 'github-actions';
        data.metadata.ciRunId = runId;
        if (data.metadata.config && typeof data.metadata.config === 'object') {
          data.metadata.config.origin = 'github-actions';
        }
        fs.writeFileSync(full, JSON.stringify(data, null, 2));
      } catch {
        // Ignorar JSON que no sea un resumen del dashboard.
      }
    }

    for (const name of fs.readdirSync(source)) {
      if (name === 'scan-report') continue;
      const from = path.join(source, name);
      const to = path.join(target, name);
      fs.rmSync(to, { recursive: true, force: true });
      fs.cpSync(from, to, { recursive: true });
    }
  }

  async function importRun(runId) {
    if (!configured()) throw new Error('Configura GITHUB_REPO y GITHUB_TOKEN en src/.env.');

    let selectedId = runId ? Number(runId) : null;
    if (!selectedId) {
      const runs = await listRuns();
      const latest = runs.find((run) => run.conclusion === 'success');
      if (!latest) throw new Error('No hay ejecuciones exitosas para importar.');
      selectedId = latest.id;
    }

    const artifacts = await listArtifacts(selectedId);
    const scanArtifact = artifacts.find((artifact) => artifact.name === 'scan');
    const reportsArtifact = artifacts.find((artifact) => artifact.name === 'reports');
    if (!scanArtifact) throw new Error('La ejecución no tiene el artefacto scan.');
    if (!reportsArtifact) throw new Error('La ejecución no tiene el artefacto reports.');

    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cachai-ci-'));
    try {
      const scanDir = path.join(temp, 'scan');
      const reportsDir = path.join(temp, 'reports');
      extractZip(await downloadArtifact(scanArtifact.id), scanDir);
      extractZip(await downloadArtifact(reportsArtifact.id), reportsDir);

      const scanFile = findFile(scanDir, 'ci-scan.json') || findFile(reportsDir, 'ci-scan.json');
      if (!scanFile) throw new Error('No se encontró ci-scan.json en los artefactos.');

      const importedAt = new Date().toISOString();
      const scanData = JSON.parse(fs.readFileSync(scanFile, 'utf8'));
      const scanRel = `scan-report/github-actions-${hostSlug(scanData.baseUrl)}-${selectedId}.json`;
      scanData.scanMeta = {
        ...(scanData.scanMeta && typeof scanData.scanMeta === 'object' ? scanData.scanMeta : {}),
        origin: 'github-actions',
        ciRunId: selectedId,
        ciImportedAt: importedAt
      };

      const scanTargetDir = path.join(root, 'scan-report');
      fs.mkdirSync(scanTargetDir, { recursive: true });
      fs.writeFileSync(path.join(root, scanRel), JSON.stringify(scanData, null, 2));

      const reportsSource = fs.existsSync(path.join(reportsDir, 'reports'))
        ? path.join(reportsDir, 'reports')
        : reportsDir;
      const reportPaths = reportPathsFromSource(reportsSource);
      copyReports(reportsDir, scanRel, selectedId);

      const current = state();
      const importedRuns = Array.isArray(current.importedRuns) ? current.importedRuns : [];
      const record = {
        runId: selectedId,
        importedAt,
        scan: scanRel,
        ...reportPaths
      };
      const next = {
        ...current,
        lastImportedRunId: selectedId,
        lastImportedAt: importedAt,
        importedRuns: [
          record,
          ...importedRuns.filter((item) => String(item.runId) !== String(selectedId))
        ].slice(0, 50)
      };
      saveState(next);

      return {
        ok: true,
        runId: selectedId,
        scan: scanRel,
        reports: 'reports/',
        ...reportPaths,
        lastImportedAt: importedAt
      };
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }

  function deleteImportedRun(runId) {
    const current = state();
    const importedRuns = Array.isArray(current.importedRuns) ? current.importedRuns : [];
    const entry = importedRuns.find((item) => String(item.runId) === String(runId));
    if (!entry) throw new Error('La ejecución importada no existe.');

    const removed = [];
    const reportsRoot = path.resolve(root, 'reports') + path.sep;
    const removeFile = (rel) => {
      if (!rel) return;
      const full = path.resolve(root, rel);
      if (!full.startsWith(reportsRoot) && full !== path.resolve(root, entry.scan || '')) return;
      try {
        if (fs.existsSync(full)) {
          fs.rmSync(full, { recursive: true, force: true });
          removed.push(rel);
        }
      } catch { /* ignore */ }
    };

    if (entry.reportPath) {
      removeFile(path.dirname(entry.reportPath).replace(/\\/g, '/'));
    }
    removeFile(entry.scan);
    removeFile(entry.defectPath);
    removeFile(entry.summaryPath);

    // El reporte Cucumber suele ser compartido entre importaciones; solo se
    // elimina si ninguna otra ejecución importada lo referencia.
    if (entry.cucumberPath) {
      const shared = importedRuns.some((item) => String(item.runId) !== String(runId)
        && item.cucumberPath === entry.cucumberPath);
      if (!shared) removeFile(entry.cucumberPath);
    }

    const next = {
      ...current,
      importedRuns: importedRuns.filter((item) => String(item.runId) !== String(runId))
    };
    if (String(next.lastImportedRunId) === String(runId)) {
      const remaining = next.importedRuns[0];
      next.lastImportedRunId = remaining ? remaining.runId : null;
      next.lastImportedAt = remaining ? remaining.importedAt : null;
    }
    saveState(next);
    return { ok: true, runId: Number(runId), removed };
  }

  return { publicConfig, listRuns, dispatchRun, importRun, deleteImportedRun };
}

module.exports = { createGithubActions };
