'use strict';

const path = require('path');

// Carga las variables de .env para que los pasos usen la misma configuración
// que Playwright (HEADLESS, timeouts, etc.).
require('dotenv').config({ path: path.join(__dirname, '.env') });

const generatedDir = path.join(__dirname, 'reports', 'generated-tests');
const cucumberDir = path.join(__dirname, 'reports', 'cucumber');

module.exports = {
  default: {
    // Los .feature y los pasos se generan en <proyecto>/reports/generated-tests
    paths: [path.join(generatedDir, '*.feature')],
    // ts-node permite ejecutar los pasos .ts sin compilarlos a mano.
    requireModule: ['ts-node/register/transpile-only'],
    require: [path.join(generatedDir, 'cachai-steps.ts')],
    format: [
      'progress',
      ['json', path.join(cucumberDir, 'cucumber-report.json')],
      ['html', path.join(cucumberDir, 'cucumber-report.html')],
      'summary'
    ],
    formatOptions: {
      snippetInterface: 'async-await'
    },
    timeout: 120000,
    retry: 1,
    parallel: 1,
    failFast: false,
    dryRun: false
  }
};
