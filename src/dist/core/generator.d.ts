/**
 * CACHAI-QA - Test Generator
 * Genera tests BDD dinámicos a partir de elementos escaneados
 */
import { ScannedPage, GeneratedTestSuite, TestGenerationConfig } from '../types';
export declare class TestGenerator {
    private config;
    private testIdCounter;
    constructor(config: TestGenerationConfig);
    /**
     * Genera suite de tests completa desde páginas escaneadas
     */
    generateTestSuite(pages: ScannedPage[], sourceUrl: string): GeneratedTestSuite;
    private generateLinkTests;
    private generateImageTests;
    private generateFormTests;
    private generateButtonTests;
    private generateConsoleErrorTests;
    private generateA11yTests;
    private generateNavigationTests;
    private nextId;
    private countElements;
}
/**
 * Exporta suite a formato Playwright Test (TypeScript)
 */
export declare function exportToPlaywrightTest(suite: GeneratedTestSuite): string;
//# sourceMappingURL=generator.d.ts.map