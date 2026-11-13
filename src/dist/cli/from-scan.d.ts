#!/usr/bin/env node
/**
 * CACHAI-QA - Pruebas en lenguaje natural a partir de un escaneo
 *
 * Lee un JSON generado por las opciones de escaneo (scan-report/*.json),
 * reconstruye las paginas y sus elementos, y genera:
 *   - reports/generated-tests/cachai-tests.spec.ts   (Playwright + BDD)
 *   - reports/generated-tests/cachai-tests.feature   (Gherkin en espanol)
 *   - reports/generated-tests/playwright.config.ts
 *   - reports/<host>-<fecha>.json                    (resumen para el panel web)
 *
 * Uso: ts-node cli/from-scan.ts [--scan=archivo.json] [--run] [--verbose]
 */
export {};
//# sourceMappingURL=from-scan.d.ts.map