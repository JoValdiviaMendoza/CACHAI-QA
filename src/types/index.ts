/**
 * CACHAI-QA - Type Definitions
 * Tipos centrales para el framework de automatización
 */

// ============================================
// Configuración
// ============================================

export interface CrawlConfig {
  targetUrl: string;
  crawlDepth: number;
  maxPages: number;
  pageLoadTimeout: number;
  elementWaitTimeout: number;
  userAgent?: string;
  browsers: BrowserType[];
  headless: boolean;
  viewport: ViewportSize;
  allowedDomains?: string[];
  blockedDomains: string[];
  ignoreUrlPatterns: string[];
  maxConcurrency: number;
  retryCount: number;
  requestDelay: number;
  respectRobotsTxt: boolean;
}

export interface BrowserStackConfig {
  username: string;
  accessKey: string;
  projectName: string;
  buildName: string;
  browsers: BrowserStackBrowserConfig[];
  sessionTimeout: number;
  video: boolean;
  networkLogs: boolean;
  consoleLogs: boolean;
}

export interface BrowserStackBrowserConfig {
  browser: 'chrome' | 'firefox' | 'safari' | 'edge';
  browser_version?: string;
  os: string;
  os_version?: string;
  device?: string;
  real_mobile?: boolean;
}

export interface TestGenerationConfig {
  checkBrokenLinks: boolean;
  checkImages: boolean;
  checkForms: boolean;
  checkButtons: boolean;
  checkConsoleErrors: boolean;
  checkA11yBasic: boolean;
}

export interface ReportConfig {
  reportDir: string;
  generateHtmlReport: boolean;
  generateJsonReport: boolean;
}

export interface AppConfig {
  crawl: CrawlConfig;
  browserstack: BrowserStackConfig;
  testGeneration: TestGenerationConfig;
  report: ReportConfig;
}

// ============================================
// Playwright / Browser Types
// ============================================

export type BrowserType = 'chromium' | 'firefox' | 'webkit';

export interface ViewportSize {
  width: number;
  height: number;
}

export interface BrowserContextOptions {
  viewport?: ViewportSize;
  userAgent?: string;
  locale?: string;
  timezoneId?: string;
  permissions?: string[];
  extraHTTPHeaders?: Record<string, string>;
}

// ============================================
// Elementos Escaneados
// ============================================

export interface ScannedPage {
  url: string;
  title: string;
  statusCode: number;
  loadTime: number;
  timestamp: Date;
  links: ScannedLink[];
  images: ScannedImage[];
  forms: ScannedForm[];
  buttons: ScannedButton[];
  consoleErrors: ConsoleError[];
  metadata: PageMetadata;
}

export interface ScannedLink {
  href: string;
  text: string;
  isInternal: boolean;
  isExternal: boolean;
  rel?: string;
  target?: string;
  statusCode?: number;
  statusText?: string;
  checked: boolean;
  parentUrl: string;
  selector: string;
}

export interface ScannedImage {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  loaded: boolean;
  statusCode?: number;
  error?: string;
  parentUrl: string;
  selector: string;
}

export interface ScannedForm {
  action: string;
  method: string;
  fields: ScannedFormField[];
  submitButtons: ScannedButton[];
  parentUrl: string;
  selector: string;
}

export interface ScannedFormField {
  name: string;
  type: string;
  tagName: 'input' | 'textarea' | 'select';
  required: boolean;
  placeholder?: string;
  value?: string;
  selector: string;
  validation?: FieldValidation;
}

export interface FieldValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  type?: 'email' | 'url' | 'number' | 'tel' | 'date';
}

export interface ScannedButton {
  text: string;
  type: 'button' | 'submit' | 'reset' | 'link' | 'unknown';
  tagName: 'button' | 'a' | 'input';
  disabled: boolean;
  visible: boolean;
  selector: string;
  parentUrl: string;
  formAction?: string;
  ariaLabel?: string;
}

export interface ConsoleError {
  type: 'error' | 'warning' | 'info' | 'log';
  text: string;
  location?: {
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
  timestamp: Date;
}

export interface PageMetadata {
  title: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  canonicalUrl?: string;
  robots?: string;
  viewport?: string;
  charset?: string;
  language?: string;
  h1Count: number;
  h2Count: number;
  wordCount: number;
}

// ============================================
// Tests Generados
// ============================================

export interface GeneratedTestSuite {
  name: string;
  description: string;
  tags: string[];
  tests: GeneratedTest[];
  metadata: TestSuiteMetadata;
}

export interface GeneratedTest {
  id: string;
  name: string;
  description: string;
  type: TestType;
  priority: TestPriority;
  tags: string[];
  steps: TestStep[];
  expectedResult: string;
  testData?: Record<string, unknown>;
  selector?: string;
  url?: string;
}

export type TestType =
  | 'broken-link'
  | 'image-load'
  | 'form-validation'
  | 'button-click'
  | 'console-error'
  | 'accessibility'
  | 'navigation'
  | 'custom';

export type TestPriority = 'critical' | 'high' | 'medium' | 'low';

export interface TestStep {
  order: number;
  action: string;
  description: string;
  selector?: string;
  value?: string;
  expectedResult: string;
}

export interface TestSuiteMetadata {
  generatedAt: Date;
  sourceUrl: string;
  totalElementsScanned: number;
  config: TestGenerationConfig;
}

// ============================================
// Resultados de Ejecución
// ============================================

export interface TestExecutionResult {
  testId: string;
  testName: string;
  status: TestStatus;
  duration: number;
  error?: string;
  stackTrace?: string;
  screenshots: string[];
  video?: string;
  logs: string[];
  timestamp: Date;
  browser: string;
  os: string;
}

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'flaky' | 'timed-out';

export interface TestRunSummary {
  runId: string;
  startTime: Date;
  endTime: Date;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  duration: number;
  browserstackSessionUrl?: string;
  reportUrl?: string;
  results: TestExecutionResult[];
}

export interface BrowserStackSession {
  sessionId: string;
  automationSession: {
    session_id: string;
    status: string;
    browser: string;
    browser_version: string;
    os: string;
    os_version: string;
    device?: string;
    start_time: string;
    end_time: string;
    duration: number;
    build_name: string;
    project_name: string;
    video_url: string;
    logs_url: string;
    network_logs_url: string;
    console_logs_url: string;
  };
}

// ============================================
// CLI / Commands
// ============================================

export interface CliOptions {
  url?: string;
  config?: string;
  local: boolean;
  browserstack: boolean;
  depth?: number;
  maxPages?: number;
  browsers?: string;
  headless?: boolean;
  verbose: boolean;
  dryRun: boolean;
  output?: string;
}

export interface ScanProgress {
  current: number;
  total: number;
  currentUrl: string;
  status: 'scanning' | 'extracting' | 'generating-tests' | 'executing' | 'completed' | 'error';
  message?: string;
}

// ============================================
// Utilidades
// ============================================

export interface UrlAnalysis {
  baseUrl: string;
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
  isInternal: boolean;
  isValid: boolean;
  normalized: string;
}

export interface SelectorInfo {
  selector: string;
  type: 'css' | 'xpath' | 'text' | 'role';
  confidence: number;
  alternatives: string[];
}