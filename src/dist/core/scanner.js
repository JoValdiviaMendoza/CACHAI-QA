"use strict";
/**
 * CACHAI-QA - Page Scanner
 * Escanea páginas web y extrae enlaces, imágenes, formularios, botones, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageScanner = void 0;
exports.createPageScanner = createPageScanner;
class PageScanner {
    config;
    baseUrl;
    consoleErrors = [];
    constructor(config) {
        this.config = config;
        this.baseUrl = new URL(config.targetUrl);
    }
    /**
     * Escanea una página completa y extrae todos los elementos
     */
    async scanPage(page, url) {
        this.consoleErrors = [];
        this.setupConsoleListener(page);
        const startTime = Date.now();
        const navigationResult = await this.navigateAndWait(page, url);
        const loadTime = Date.now() - startTime;
        if (!navigationResult.success) {
            throw new Error(`Failed to navigate to ${url}: ${navigationResult.error}`);
        }
        // Esperar a que la página esté lista
        await this.waitForPageReady(page);
        // Extraer todos los elementos
        const [links, images, forms, buttons, metadata] = await Promise.all([
            this.extractLinks(page, url),
            this.extractImages(page, url),
            this.extractForms(page, url),
            this.extractButtons(page, url),
            this.extractMetadata(page)
        ]);
        const scannedPage = {
            url,
            title: await page.title(),
            statusCode: navigationResult.statusCode || 200,
            loadTime,
            timestamp: new Date(),
            links,
            images,
            forms,
            buttons,
            consoleErrors: [...this.consoleErrors],
            metadata
        };
        // Filtrar URLs nuevas para rastreo
        const newUrls = this.filterUrlsForCrawling(links.map((l) => l.href), url);
        return { page: scannedPage, newUrls };
    }
    /**
     * Configura listener para errores de consola
     */
    setupConsoleListener(page) {
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.type() === 'warning') {
                const location = msg.location();
                this.consoleErrors.push({
                    type: msg.type(),
                    text: msg.text(),
                    location: location ? {
                        url: location.url,
                        lineNumber: location.lineNumber,
                        columnNumber: location.columnNumber
                    } : undefined,
                    timestamp: new Date()
                });
            }
        });
        // Capturar errores de JavaScript no manejados
        page.on('pageerror', error => {
            this.consoleErrors.push({
                type: 'error',
                text: error.message,
                timestamp: new Date()
            });
        });
    }
    /**
     * Navega a la URL y espera carga
     */
    async navigateAndWait(page, url) {
        try {
            const response = await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: this.config.pageLoadTimeout
            });
            // Esperar network idle con timeout corto
            try {
                await page.waitForLoadState('networkidle', { timeout: 5000 });
            }
            catch {
                // Ignorar timeout de networkidle
            }
            return {
                success: true,
                statusCode: response?.status()
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Espera a que la página esté lista para escanear
     */
    async waitForPageReady(page) {
        // Esperar a que el body esté presente
        await page.waitForSelector('body', { timeout: this.config.elementWaitTimeout });
        // Pequeña pausa para contenido dinámico
        await page.waitForTimeout(500);
    }
    // ============================================
    // Extractores de elementos
    // ============================================
    /**
     * Extrae todos los enlaces de la página
     */
    async extractLinks(page, parentUrl) {
        const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href]'));
            return anchors.map((a, index) => {
                const anchor = a;
                return {
                    href: anchor.href,
                    hrefAttr: anchor.getAttribute('href') || '',
                    text: anchor.textContent?.trim() || '',
                    rel: anchor.rel || '',
                    target: anchor.target || '',
                    tagName: anchor.tagName.toLowerCase(),
                    id: anchor.id,
                    className: anchor.className,
                    parentTagName: anchor.parentElement?.tagName.toLowerCase() || '',
                    parentClassName: anchor.parentElement?.className || '',
                    index
                };
            });
        });
        return links.map((link) => {
            const selector = this.generateSelectorFromData(link);
            return {
                href: link.href,
                text: link.text,
                rel: link.rel,
                target: link.target,
                isInternal: this.isInternalUrl(link.href),
                isExternal: !this.isInternalUrl(link.href),
                checked: false,
                parentUrl,
                selector: selector || `a[href="${link.hrefAttr}"]`
            };
        });
    }
    /**
     * Extrae todas las imágenes de la página
     */
    async extractImages(page, parentUrl) {
        const images = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img[src]'));
            return imgs.map((img, index) => {
                const image = img;
                return {
                    src: image.src,
                    srcAttr: image.getAttribute('src') || '',
                    alt: image.alt || '',
                    width: image.width || undefined,
                    height: image.height || undefined,
                    naturalWidth: image.naturalWidth || undefined,
                    naturalHeight: image.naturalHeight || undefined,
                    complete: image.complete,
                    tagName: image.tagName.toLowerCase(),
                    id: image.id,
                    className: image.className,
                    parentTagName: image.parentElement?.tagName.toLowerCase() || '',
                    parentClassName: image.parentElement?.className || '',
                    index
                };
            });
        });
        return images.map((img) => {
            const selector = this.generateSelectorFromData(img);
            return {
                src: img.src,
                alt: img.alt,
                width: img.width,
                height: img.height,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                complete: img.complete,
                loaded: img.complete && (img.naturalWidth || 0) > 0,
                parentUrl,
                selector: selector || `img[src="${img.srcAttr}"]`
            };
        });
    }
    /**
     * Extrae todos los formularios de la página
     */
    async extractForms(page, parentUrl) {
        const forms = await page.evaluate(() => {
            const formElements = Array.from(document.querySelectorAll('form'));
            return formElements.map((form, formIndex) => {
                const f = form;
                const fields = Array.from(f.querySelectorAll('input, textarea, select')).map((field, fieldIndex) => {
                    const input = field;
                    // placeholder exists on HTMLInputElement and HTMLTextAreaElement but not HTMLSelectElement
                    const placeholder = 'placeholder' in input ? (input.placeholder || '') : '';
                    return {
                        name: input.name || '',
                        type: input.type || (input.tagName.toLowerCase() === 'select' ? 'select' : 'textarea'),
                        typeAttr: input.getAttribute('type') || '',
                        tagName: input.tagName.toLowerCase(),
                        required: input.required,
                        placeholder,
                        value: input.value || '',
                        tagNameLower: input.tagName.toLowerCase(),
                        id: input.id,
                        className: input.className,
                        parentTagName: input.parentElement?.tagName.toLowerCase() || '',
                        parentClassName: input.parentElement?.className || '',
                        fieldIndex
                    };
                });
                const submitButtons = Array.from(f.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type])')).map((btn, btnIndex) => {
                    const button = btn;
                    return {
                        text: button.textContent?.trim() || button.value || 'Submit',
                        type: 'submit',
                        typeAttr: button.getAttribute('type') || '',
                        tagName: button.tagName.toLowerCase(),
                        disabled: button.disabled,
                        visible: true,
                        tagNameLower: button.tagName.toLowerCase(),
                        id: button.id,
                        className: button.className,
                        parentTagName: button.parentElement?.tagName.toLowerCase() || '',
                        parentClassName: button.parentElement?.className || '',
                        btnIndex
                    };
                });
                return {
                    action: f.action || window.location.href,
                    actionAttr: f.getAttribute('action') || '',
                    method: f.method || 'GET',
                    fields,
                    submitButtons,
                    tagName: f.tagName.toLowerCase(),
                    id: f.id,
                    className: f.className,
                    parentTagName: f.parentElement?.tagName.toLowerCase() || '',
                    parentClassName: f.parentElement?.className || '',
                    formIndex
                };
            });
        });
        return forms.map((form) => {
            const fields = form.fields.map((field) => ({
                ...field,
                selector: this.generateSelectorFromData(field)
            }));
            const submitButtons = form.submitButtons.map((btn) => ({
                ...btn,
                selector: this.generateSelectorFromData(btn)
            }));
            return {
                action: form.action,
                method: form.method,
                fields,
                submitButtons,
                parentUrl,
                selector: this.generateSelectorFromData(form) || `form[action="${form.actionAttr}"]`
            };
        });
    }
    /**
     * Extrae todos los botones interactivos de la página
     */
    async extractButtons(page, parentUrl) {
        const buttons = await page.evaluate(() => {
            const selectors = [
                'button:not([type="submit"]):not([type="reset"])',
                'input[type="button"]',
                'input[type="reset"]',
                'a[role="button"]',
                'a.btn, a.button, a[class*="btn"]',
                '[role="button"]:not(button):not(a)'
            ];
            const elements = Array.from(document.querySelectorAll(selectors.join(',')));
            return elements.map((el, index) => {
                const element = el;
                let type = 'unknown';
                const tagName = element.tagName.toLowerCase();
                if (tagName === 'button') {
                    const btn = element;
                    type = btn.type || 'button';
                }
                else if (tagName === 'input') {
                    const inp = element;
                    type = inp.type;
                }
                else if (tagName === 'a') {
                    type = 'link';
                }
                else if (element.getAttribute('role') === 'button') {
                    type = 'button';
                }
                return {
                    text: element.textContent?.trim() || element.getAttribute('aria-label') || element.getAttribute('value') || '',
                    type,
                    typeAttr: element.getAttribute('type') || '',
                    tagName: tagName,
                    disabled: element.hasAttribute('disabled') || element.disabled,
                    visible: true,
                    tagNameLower: element.tagName.toLowerCase(),
                    id: element.id,
                    className: element.className,
                    parentTagName: element.parentElement?.tagName.toLowerCase() || '',
                    parentClassName: element.parentElement?.className || '',
                    ariaLabel: element.getAttribute('aria-label') || undefined,
                    index
                };
            });
        });
        return buttons.map((btn) => ({
            ...btn,
            selector: this.generateSelectorFromData(btn) || `[data-cachai-btn="${btn.text.substring(0, 20)}"]`,
            parentUrl
        }));
    }
    /**
     * Extrae metadatos de la página
     */
    async extractMetadata(page) {
        return page.evaluate(() => {
            const getMeta = (name, property = false) => {
                const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
                return document.querySelector(selector)?.getAttribute('content') || undefined;
            };
            const getLink = (rel) => {
                return document.querySelector(`link[rel="${rel}"]`)?.getAttribute('href') || undefined;
            };
            const text = document.body?.innerText || '';
            const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
            return {
                title: document.title,
                description: getMeta('description'),
                keywords: getMeta('keywords'),
                ogTitle: getMeta('og:title', true),
                ogDescription: getMeta('og:description', true),
                ogImage: getMeta('og:image', true),
                ogType: getMeta('og:type', true),
                canonicalUrl: getLink('canonical'),
                robots: getMeta('robots'),
                viewport: getMeta('viewport'),
                charset: document.characterSet,
                language: document.documentElement.lang || 'es',
                h1Count: document.querySelectorAll('h1').length,
                h2Count: document.querySelectorAll('h2').length,
                wordCount: words.length
            };
        });
    }
    // ============================================
    // Utilidades
    // ============================================
    /**
     * Verifica si una URL es interna (mismo dominio)
     */
    isInternalUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.hostname === this.baseUrl.hostname;
        }
        catch {
            return false;
        }
    }
    /**
     * Filtra URLs válidas para rastreo
     */
    filterUrlsForCrawling(urls, parentUrl) {
        const seen = new Set();
        const result = [];
        for (const url of urls) {
            if (seen.has(url))
                continue;
            const analysis = this.analyzeUrl(url);
            if (!analysis.isValid || !analysis.isInternal)
                continue;
            // Verificar patrones de ignorar
            if (this.shouldIgnoreUrl(url))
                continue;
            // Verificar dominios bloqueados
            if (this.isBlockedDomain(url))
                continue;
            seen.add(url);
            result.push(analysis.normalized);
        }
        return result;
    }
    /**
     * Analiza una URL
     */
    analyzeUrl(url) {
        try {
            const parsed = new URL(url);
            const base = this.baseUrl;
            const isInternal = parsed.hostname === base.hostname;
            let normalized = url;
            // Normalizar: remover hash, ordenar query params
            if (isInternal) {
                const clean = new URL(url);
                clean.hash = '';
                // Ordenar search params para consistencia
                const params = Array.from(clean.searchParams.entries()).sort((a, b) => a[0].localeCompare(b[0]));
                clean.search = new URLSearchParams(params).toString();
                normalized = clean.toString();
            }
            return {
                baseUrl: base.origin,
                hostname: parsed.hostname,
                pathname: parsed.pathname,
                search: parsed.search,
                hash: parsed.hash,
                isInternal,
                isValid: true,
                normalized
            };
        }
        catch {
            return {
                baseUrl: this.baseUrl.origin,
                hostname: '',
                pathname: '',
                search: '',
                hash: '',
                isInternal: false,
                isValid: false,
                normalized: url
            };
        }
    }
    /**
     * Verifica si la URL debe ser ignorada
     */
    shouldIgnoreUrl(url) {
        for (const pattern of this.config.ignoreUrlPatterns) {
            try {
                const regex = new RegExp(pattern);
                if (regex.test(url))
                    return true;
            }
            catch {
                // Patrones inválidos se ignoran
            }
        }
        return false;
    }
    /**
     * Verifica si el dominio está bloqueado
     */
    isBlockedDomain(url) {
        try {
            const hostname = new URL(url).hostname;
            return this.config.blockedDomains.some((blocked) => hostname === blocked || hostname.endsWith('.' + blocked));
        }
        catch {
            return false;
        }
    }
    /**
     * Genera un selector CSS único para un elemento
     */
    generateSelector(element, index) {
        // Intentar ID primero
        if (element.id) {
            return `#${element.id}`;
        }
        // Intentar data-testid o similares
        const testAttrs = ['data-testid', 'data-cy', 'data-test', 'data-qa'];
        for (const attr of testAttrs) {
            const value = element.getAttribute(attr);
            if (value)
                return `[${attr}="${value}"]`;
        }
        // Construir selector por clase y posición
        const tagName = element.tagName.toLowerCase();
        const classes = Array.from(element.classList).filter(c => !c.startsWith('_')).slice(0, 3);
        let selector = tagName;
        if (classes.length > 0) {
            selector += '.' + classes.join('.');
        }
        // Agregar nth-of-type si hay hermanos similares
        const parent = element.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(el => el.tagName === element.tagName && el.className === element.className);
            if (siblings.length > 1) {
                const position = siblings.indexOf(element) + 1;
                selector += `:nth-of-type(${position})`;
            }
        }
        return selector;
    }
    /**
     * Genera un selector CSS estable a partir de datos serializados.
     *
     * Se prefieren atributos únicos (id, name, href, src, type) antes que
     * posiciones (:nth-of-type), que son frágiles: el índice recolectado es
     * global a la página, mientras que :nth-of-type es relativo al padre, así
     * que antes producía selectores inexistentes (timeout) o ambiguos
     * (strict mode violation).
     */
    generateSelectorFromData(data) {
        const tag = (data.tagName || '').toLowerCase();
        // 1) id: el identificador más fiable.
        if (data.id)
            return this.idSelector(data.id);
        // 2) Enlaces: href tal como está escrito en el documento (+ texto si es seguro).
        if (data.hrefAttr) {
            return `a[href="${this.cssAttrValue(data.hrefAttr)}"]${this.textIsSuffix(data.text || '')}`;
        }
        // 3) Imágenes: src tal como está escrito.
        if (data.srcAttr) {
            return `img[src="${this.cssAttrValue(data.srcAttr)}"]`;
        }
        // 4) Campos de formulario y botones: name o type (atributo real del DOM).
        if (data.name)
            return `${tag}[name="${this.cssAttrValue(data.name)}"]`;
        if (data.typeAttr)
            return `${tag}[type="${this.cssAttrValue(data.typeAttr)}"]`;
        // 5) Formularios: action tal como está escrita.
        if (tag === 'form' && data.actionAttr) {
            return `form[action="${this.cssAttrValue(data.actionAttr)}"]`;
        }
        // 6) Botones por texto visible (último recurso antes de las clases).
        const text = (data.text || data.ariaLabel || '').trim();
        if (tag === 'button' && text)
            return `button${this.textIsSuffix(text)}`;
        // 7) Clases como último recurso.
        const classes = (data.className || '')
            .split(/\s+/)
            .filter((c) => c && !c.startsWith('_'))
            .slice(0, 3);
        if (classes.length > 0)
            return `${tag}.${classes.join('.')}`;
        return tag;
    }
    /** Selector por id, escapando ids con caracteres no válidos en CSS. */
    idSelector(id) {
        return /^[A-Za-z_][\w-]*$/.test(id) ? `#${id}` : `[id="${this.cssAttrValue(id)}"]`;
    }
    /** Escapa un valor para usarlo dentro de un selector de atributo CSS. */
    cssAttrValue(value) {
        return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n\t]/g, ' ');
    }
    /** Sufijo :text-is("...") para desambiguar por texto exacto (si es seguro). */
    textIsSuffix(text) {
        const value = text.trim();
        if (!value)
            return '';
        if (/["\\\r\n]/.test(value))
            return '';
        return `:text-is("${value}")`;
    }
    /**
     * Verifica si un elemento es visible
     */
    isElementVisible(element) {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            element.offsetWidth > 0 &&
            element.offsetHeight > 0;
    }
    /**
     * Obtiene errores de consola capturados
     */
    getConsoleErrors() {
        return [...this.consoleErrors];
    }
    /**
     * Limpia errores capturados
     */
    clearConsoleErrors() {
        this.consoleErrors = [];
    }
}
exports.PageScanner = PageScanner;
/**
 * Crea una instancia del scanner
 */
function createPageScanner(config) {
    return new PageScanner(config);
}
//# sourceMappingURL=scanner.js.map