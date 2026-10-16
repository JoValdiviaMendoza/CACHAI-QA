"use strict";
/**
 * CACHAI-QA - Test Generator
 * Genera tests BDD dinámicos a partir de elementos escaneados
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestGenerator = void 0;
exports.exportToPlaywrightTest = exportToPlaywrightTest;
class TestGenerator {
    config;
    testIdCounter = 0;
    constructor(config) {
        this.config = config;
    }
    /**
     * Genera suite de tests completa desde páginas escaneadas
     */
    generateTestSuite(pages, sourceUrl) {
        this.testIdCounter = 0;
        const allTests = [];
        for (const page of pages) {
            if (this.config.checkBrokenLinks) {
                allTests.push(...this.generateLinkTests(page));
            }
            if (this.config.checkImages) {
                allTests.push(...this.generateImageTests(page));
            }
            if (this.config.checkForms) {
                allTests.push(...this.generateFormTests(page));
            }
            if (this.config.checkButtons) {
                allTests.push(...this.generateButtonTests(page));
            }
            if (this.config.checkConsoleErrors) {
                allTests.push(...this.generateConsoleErrorTests(page));
            }
            if (this.config.checkA11yBasic) {
                allTests.push(...this.generateA11yTests(page));
            }
        }
        // Tests de navegación entre páginas
        allTests.push(...this.generateNavigationTests(pages));
        return {
            name: `CACHAI-QA Suite - ${new URL(sourceUrl).hostname}`,
            description: `Pruebas generadas automáticamente para ${sourceUrl} (${pages.length} páginas escaneadas)`,
            tags: ['cachai-qa', 'auto-generated', 'regression'],
            tests: allTests,
            metadata: {
                generatedAt: new Date(),
                sourceUrl,
                totalElementsScanned: this.countElements(pages),
                config: this.config
            }
        };
    }
    // ============================================
    // Generadores por tipo
    // ============================================
    generateLinkTests(page) {
        const tests = [];
        for (const link of page.links) {
            if (!link.isInternal)
                continue; // Solo links internos para tests de broken links
            tests.push({
                id: this.nextId('link'),
                name: `[${page.url}] Verificar enlace interno: "${link.text.substring(0, 50)}"`,
                description: `El enlace "${link.text}" en ${page.url} debe responder 2xx/3xx`,
                type: 'broken-link',
                priority: link.text.toLowerCase().includes('login') || link.text.toLowerCase().includes('registro') ? 'critical' : 'high',
                tags: ['links', 'navigation', page.url],
                steps: [
                    {
                        order: 1,
                        action: 'navigate',
                        description: `Navegar a la página origen: ${page.url}`,
                        expectedResult: 'Página carga correctamente'
                    },
                    {
                        order: 2,
                        action: 'click',
                        description: `Clic en enlace: "${link.text}"`,
                        selector: link.selector,
                        expectedResult: 'Navega a URL destino sin errores'
                    },
                    {
                        order: 3,
                        action: 'assert',
                        description: 'Verificar código de respuesta HTTP',
                        expectedResult: 'Status code 2xx o 3xx (no 4xx/5xx)'
                    }
                ],
                expectedResult: 'Enlace funcional sin errores 4xx/5xx',
                selector: link.selector,
                url: link.href
            });
        }
        return tests;
    }
    generateImageTests(page) {
        const tests = [];
        for (const img of page.images) {
            tests.push({
                id: this.nextId('img'),
                name: `[${page.url}] Verificar carga de imagen: ${img.src.substring(0, 60)}...`,
                description: `La imagen en ${page.url} debe cargar correctamente (alt: "${img.alt.substring(0, 50)}")`,
                type: 'image-load',
                priority: img.alt ? 'medium' : 'high', // Sin alt = prioridad alta (a11y)
                tags: ['images', 'media', page.url],
                steps: [
                    {
                        order: 1,
                        action: 'navigate',
                        description: `Navegar a: ${page.url}`,
                        expectedResult: 'Página carga'
                    },
                    {
                        order: 2,
                        action: 'assert',
                        description: 'Verificar que imagen tiene src válido',
                        selector: img.selector,
                        expectedResult: 'Atributo src presente y no vacío'
                    },
                    {
                        order: 3,
                        action: 'assert',
                        description: 'Verificar carga exitosa (naturalWidth > 0)',
                        selector: img.selector,
                        expectedResult: 'Imagen renderizada (naturalWidth > 0, status 2xx)'
                    },
                    {
                        order: 4,
                        action: 'assert',
                        description: 'Verificar atributo alt presente',
                        selector: img.selector,
                        expectedResult: img.alt ? `Alt text: "${img.alt}"` : 'FALTA alt (problema accesibilidad)'
                    }
                ],
                expectedResult: 'Imagen carga correctamente y tiene alt text',
                selector: img.selector,
                url: page.url
            });
        }
        return tests;
    }
    generateFormTests(page) {
        const tests = [];
        for (const form of page.forms) {
            // Test de presencia y estructura
            tests.push({
                id: this.nextId('form'),
                name: `Verificar formulario en ${page.url}`,
                description: `Formulario (action: ${form.method} ${form.action}) tiene campos válidos`,
                type: 'form-validation',
                priority: 'high',
                tags: ['forms', 'input', page.url],
                steps: [
                    {
                        order: 1,
                        action: 'navigate',
                        description: `Navegar a: ${page.url}`,
                        expectedResult: 'Página carga'
                    },
                    {
                        order: 2,
                        action: 'assert',
                        description: 'Verificar formulario visible',
                        selector: form.selector,
                        expectedResult: 'Formulario renderizado y visible'
                    },
                    {
                        order: 3,
                        action: 'assert',
                        description: `Verificar ${form.fields.length} campos presentes`,
                        expectedResult: 'Todos los campos (input/textarea/select) existen'
                    },
                    {
                        order: 4,
                        action: 'assert',
                        description: 'Verificar labels asociados a campos requeridos',
                        expectedResult: 'Cada input required tiene label o aria-label'
                    }
                ],
                expectedResult: 'Formulario completo y accesible',
                selector: form.selector,
                url: page.url
            });
            // Tests por cada campo
            for (const field of form.fields) {
                if (field.required) {
                    tests.push({
                        id: this.nextId('field'),
                        name: `Validar campo requerido: ${field.name} (${field.type})`,
                        description: `Campo ${field.name} debe mostrar error si se envía vacío`,
                        type: 'form-validation',
                        priority: 'medium',
                        tags: ['forms', 'validation', 'required', page.url],
                        steps: [
                            {
                                order: 1,
                                action: 'navigate',
                                description: `Navegar a: ${page.url}`,
                                expectedResult: 'Página carga'
                            },
                            {
                                order: 2,
                                action: 'click',
                                description: 'Intentar enviar formulario sin completar campo requerido',
                                selector: form.submitButtons[0]?.selector || form.selector,
                                expectedResult: 'Validación nativa o mensaje de error'
                            },
                            {
                                order: 3,
                                action: 'assert',
                                description: 'Verificar mensaje de validación',
                                selector: field.selector,
                                expectedResult: 'Error visible para campo requerido'
                            }
                        ],
                        expectedResult: 'Validación de campo requerido funciona',
                        selector: field.selector,
                        url: page.url
                    });
                }
                // Validación de tipo (email, url, number)
                if (field.validation?.type === 'email' || field.type === 'email') {
                    tests.push({
                        id: this.nextId('field'),
                        name: `[${page.url}] Validar formato email: ${field.name}`,
                        description: `Campo email rechaza formato inválido`,
                        type: 'form-validation',
                        priority: 'medium',
                        tags: ['forms', 'validation', 'email', page.url],
                        steps: [
                            {
                                order: 1,
                                action: 'navigate',
                                description: `Navegar a: ${page.url}`,
                                expectedResult: 'Página carga'
                            },
                            {
                                order: 2,
                                action: 'fill',
                                description: 'Ingresar email inválido',
                                selector: field.selector,
                                value: 'no-es-email',
                                expectedResult: 'Valor ingresado'
                            },
                            {
                                order: 3,
                                action: 'click',
                                description: 'Enviar formulario',
                                selector: form.submitButtons[0]?.selector || form.selector,
                                expectedResult: 'Intento de envío'
                            },
                            {
                                order: 4,
                                action: 'assert',
                                description: 'Verificar error de formato email',
                                selector: field.selector,
                                expectedResult: 'Error de validación email visible'
                            }
                        ],
                        expectedResult: 'Validación de formato email funciona',
                        selector: field.selector,
                        url: page.url
                    });
                }
            }
        }
        return tests;
    }
    generateButtonTests(page) {
        const tests = [];
        // Filtrar botones principales (CTAs, submits, botones visibles con texto)
        const mainButtons = page.buttons.filter((btn) => btn.visible &&
            btn.text.length > 0 &&
            (btn.type === 'submit' || btn.type === 'button' ||
                btn.text.toLowerCase().includes('comprar') ||
                btn.text.toLowerCase().includes('enviar') ||
                btn.text.toLowerCase().includes('registrar') ||
                btn.text.toLowerCase().includes('iniciar') ||
                btn.text.toLowerCase().includes('contactar') ||
                btn.text.toLowerCase().includes('descargar')));
        for (const btn of mainButtons.slice(0, 10)) { // Máx 10 botones por página
            tests.push({
                id: this.nextId('btn'),
                name: `[${page.url}] Verificar botón principal: "${btn.text.substring(0, 50)}"`,
                description: `Botón ${btn.type} (${btn.tagName}) en ${page.url} debe ser clickeable`,
                type: 'button-click',
                priority: btn.type === 'submit' ? 'high' : 'medium',
                tags: ['buttons', 'interaction', 'cta', page.url],
                steps: [
                    {
                        order: 1,
                        action: 'navigate',
                        description: `Navegar a: ${page.url}`,
                        expectedResult: 'Página carga'
                    },
                    {
                        order: 2,
                        action: 'assert',
                        description: 'Verificar botón visible y habilitado',
                        selector: btn.selector,
                        expectedResult: 'Botón visible, no disabled, clickable'
                    },
                    {
                        order: 3,
                        action: 'click',
                        description: `Clic en botón: "${btn.text}"`,
                        selector: btn.selector,
                        expectedResult: 'Acción ejecutada (navegación, submit, modal, etc.)'
                    },
                    {
                        order: 4,
                        action: 'assert',
                        description: 'Verificar respuesta esperada tras clic',
                        expectedResult: 'Sin errores JS, navegación o feedback visual'
                    }
                ],
                expectedResult: 'Botón funcional sin errores',
                selector: btn.selector,
                url: page.url
            });
        }
        return tests;
    }
    generateConsoleErrorTests(page) {
        const errorTests = [];
        const errors = page.consoleErrors.filter((e) => e.type === 'error');
        if (errors.length === 0) {
            // Test positivo: sin errores
            return [{
                    id: this.nextId('console'),
                    name: `Verificar ausencia de errores JS en ${page.url}`,
                    description: 'Consola del navegador sin errores JavaScript',
                    type: 'console-error',
                    priority: 'high',
                    tags: ['console', 'errors', 'javascript', page.url],
                    steps: [
                        {
                            order: 1,
                            action: 'navigate',
                            description: `Navegar a: ${page.url}`,
                            expectedResult: 'Página carga'
                        },
                        {
                            order: 2,
                            action: 'assert',
                            description: 'Verificar consola sin errores',
                            expectedResult: '0 errores tipo "error" en consola'
                        }
                    ],
                    expectedResult: 'Sin errores JavaScript en consola',
                    url: page.url
                }];
        }
        // Test por cada error encontrado
        for (const error of errors.slice(0, 5)) { // Máx 5 errores por página
            errorTests.push({
                id: this.nextId('console'),
                name: `[${page.url}] Detectar error JS: ${error.text.substring(0, 60)}...`,
                description: `Error en consola en ${page.url}${error.location ? ` (${error.location.url}:${error.location.lineNumber})` : ''}`,
                type: 'console-error',
                priority: 'critical',
                tags: ['console', 'errors', 'javascript', 'bug', page.url],
                steps: [
                    {
                        order: 1,
                        action: 'navigate',
                        description: `Navegar a: ${page.url}`,
                        expectedResult: 'Página carga'
                    },
                    {
                        order: 2,
                        action: 'assert',
                        description: 'Verificar error en consola',
                        expectedResult: `Error detectado: ${error.text}`
                    }
                ],
                expectedResult: 'Error JavaScript identificado para corrección',
                url: page.url
            });
        }
        return errorTests;
    }
    generateA11yTests(page) {
        const tests = [];
        // Imágenes sin alt
        const imagesWithoutAlt = page.images.filter((img) => !img.alt || img.alt.trim() === '');
        if (imagesWithoutAlt.length > 0) {
            tests.push({
                id: this.nextId('a11y'),
                name: `Accesibilidad: ${imagesWithoutAlt.length} imágenes sin alt text`,
                description: 'Imágenes deben tener atributo alt para lectores de pantalla',
                type: 'accessibility',
                priority: 'high',
                tags: ['a11y', 'images', 'alt', 'wcag', page.url],
                steps: [
                    {
                        order: 1,
                        action: 'navigate',
                        description: `Navegar a: ${page.url}`,
                        expectedResult: 'Página carga'
                    },
                    {
                        order: 2,
                        action: 'assert',
                        description: `Verificar ${imagesWithoutAlt.length} imágenes sin alt`,
                        expectedResult: 'Lista de imágenes sin atributo alt'
                    }
                ],
                expectedResult: 'Identificar imágenes sin alt para corrección',
                url: page.url
            });
        }
        // Inputs sin label
        const inputsWithoutLabel = [];
        for (const form of page.forms) {
            for (const field of form.fields) {
                if (field.required && field.tagName === 'input' && field.type !== 'hidden') {
                    // Verificación simple: si no tiene label asociado (se validaría en test real)
                    inputsWithoutLabel.push(field);
                }
            }
        }
        if (inputsWithoutLabel.length > 0) {
            tests.push({
                id: this.nextId('a11y'),
                name: `Accesibilidad: ${inputsWithoutLabel.length} campos requeridos sin label claro`,
                description: 'Inputs requeridos deben tener label asociado o aria-label',
                type: 'accessibility',
                priority: 'high',
                tags: ['a11y', 'forms', 'labels', 'wcag', page.url],
                steps: [
                    {
                        order: 1,
                        action: 'navigate',
                        description: `Navegar a: ${page.url}`,
                        expectedResult: 'Página carga'
                    },
                    {
                        order: 2,
                        action: 'assert',
                        description: 'Verificar labels en campos requeridos',
                        expectedResult: 'Cada input required tiene label visible o aria-label'
                    }
                ],
                expectedResult: 'Identificar campos sin label accesible',
                url: page.url
            });
        }
        // Estructura de headings
        if (page.metadata.h1Count === 0) {
            tests.push({
                id: this.nextId('a11y'),
                name: 'Accesibilidad: Página sin h1 principal',
                description: 'Cada página debe tener exactamente un h1 para estructura semántica',
                type: 'accessibility',
                priority: 'medium',
                tags: ['a11y', 'headings', 'semantics', 'wcag', page.url],
                steps: [
                    {
                        order: 1,
                        action: 'navigate',
                        description: `Navegar a: ${page.url}`,
                        expectedResult: 'Página carga'
                    },
                    {
                        order: 2,
                        action: 'assert',
                        description: 'Verificar presencia de h1',
                        expectedResult: 'Exactamente 1 elemento h1 en la página'
                    }
                ],
                expectedResult: 'Página tiene h1 principal',
                url: page.url
            });
        }
        else if (page.metadata.h1Count > 1) {
            tests.push({
                id: this.nextId('a11y'),
                name: `Accesibilidad: ${page.metadata.h1Count} elementos h1 (debe ser 1)`,
                description: 'Solo debe haber un h1 por página',
                type: 'accessibility',
                priority: 'medium',
                tags: ['a11y', 'headings', 'semantics', page.url],
                steps: [
                    {
                        order: 1,
                        action: 'navigate',
                        description: `Navegar a: ${page.url}`,
                        expectedResult: 'Página carga'
                    },
                    {
                        order: 2,
                        action: 'assert',
                        description: 'Contar elementos h1',
                        expectedResult: 'Solo 1 h1 principal'
                    }
                ],
                expectedResult: 'Un solo h1 por página',
                url: page.url
            });
        }
        return tests;
    }
    generateNavigationTests(pages) {
        if (pages.length <= 1)
            return [];
        const tests = [];
        // Test de navegación básica entre páginas
        tests.push({
            id: this.nextId('nav'),
            name: 'Navegación: Verificar carga de páginas internas',
            description: `${pages.length} páginas internas deben cargar sin errores 4xx/5xx`,
            type: 'navigation',
            priority: 'high',
            tags: ['navigation', 'smoke', 'multi-page'],
            steps: pages.map((page, i) => ({
                order: i + 1,
                action: 'navigate',
                description: `Cargar página: ${page.url}`,
                expectedResult: 'Status 2xx, sin errores JS críticos'
            })),
            expectedResult: 'Todas las páginas internas cargan correctamente',
            url: pages[0].url
        });
        return tests;
    }
    // ============================================
    // Utilidades
    // ============================================
    nextId(prefix) {
        this.testIdCounter++;
        return `${prefix}-${this.testIdCounter.toString().padStart(4, '0')}`;
    }
    countElements(pages) {
        return pages.reduce((sum, p) => sum + p.links.length + p.images.length + p.forms.length + p.buttons.length, 0);
    }
}
exports.TestGenerator = TestGenerator;
/**
 * Exporta suite a formato Playwright Test (TypeScript)
 */
function exportToPlaywrightTest(suite) {
    const lines = [
        `// Auto-generado por CACHAI-QA - ${suite.metadata.generatedAt.toISOString()}`,
        `// Fuente: ${suite.metadata.sourceUrl}`,
        `// Total tests: ${suite.tests.length}`,
        ``,
        `import { test, expect } from '@playwright/test';`,
        ``,
        `test.describe('${suite.name}', () => {`,
    ];
    const usedTitles = new Set();
    for (const t of suite.tests) {
        // Playwright exige titulos unicos dentro del archivo: si dos tests comparten
        // nombre, se agrega un sufijo numerico para evitar "duplicate test title".
        const baseTitle = escapeString(t.name);
        let testTitle = baseTitle;
        let suffix = 1;
        while (usedTitles.has(testTitle)) {
            suffix++;
            testTitle = `${baseTitle} (${suffix})`;
        }
        usedTitles.add(testTitle);
        lines.push(`  test('${testTitle}', async ({ page }) => {`);
        lines.push(`    // ${t.description}`);
        lines.push(`    // Priority: ${t.priority} | Type: ${t.type}`);
        lines.push(``);
        for (const step of t.steps) {
            lines.push(`    // Step ${step.order}: ${step.description}`);
            if (step.action === 'navigate') {
                const urlMatch = step.description.match(/https?:\/\/[^\s]+/);
                if (urlMatch) {
                    lines.push(`    await page.goto('${urlMatch[0]}', { waitUntil: 'domcontentloaded' });`);
                }
            }
            else if (step.action === 'click' && step.selector) {
                lines.push(`    await page.locator('${escapeSelector(step.selector)}').click();`);
            }
            else if (step.action === 'fill' && step.selector && step.value) {
                lines.push(`    await page.locator('${escapeSelector(step.selector)}').fill('${escapeString(step.value)}');`);
            }
            else if (step.action === 'assert') {
                if (step.description.includes('Status code') || step.description.includes('status')) {
                    lines.push(`    // TODO: Implementar verificación de status HTTP`);
                }
                else if (step.description.includes('visible') || step.description.includes('rendered')) {
                    lines.push(`    await expect(page.locator('${escapeSelector(step.selector || 'body')}')).toBeVisible();`);
                }
                else if (step.description.includes('console') || step.description.includes('error')) {
                    lines.push(`    // TODO: Implementar captura de errores de consola`);
                }
                else {
                    lines.push(`    // Assertion: ${step.expectedResult}`);
                }
            }
        }
        lines.push(`  });`);
        lines.push(``);
    }
    lines.push(`});`);
    return lines.join('\n');
}
function escapeString(str) {
    return str.replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/\r/g, '');
}
function escapeSelector(sel) {
    return sel.replace(/'/g, "\\'").replace(/"/g, '\\"');
}
//# sourceMappingURL=generator.js.map