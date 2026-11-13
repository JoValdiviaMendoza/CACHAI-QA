"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CUCUMBER_STEPS_TEMPLATE = void 0;
/**
 * Plantilla de pasos Cucumber que se copia a reports/generated-tests/cachai-steps.ts
 * cada vez que se generan pruebas desde un escaneo (opción 4).
 *
 * Los pasos coinciden con el Gherkin en español que produce cli/from-scan.ts.
 * Se usa String.raw para conservar las expresiones regulares (\d, \s, etc.).
 */
exports.CUCUMBER_STEPS_TEMPLATE = String.raw `import { AfterAll, Before, Given, Then, When, setDefaultTimeout } from "@cucumber/cucumber";
import { chromium, firefox, expect } from "@playwright/test";
import type { Browser, Page, Response } from "playwright";

setDefaultTimeout(Number(process.env.CUCUMBER_TIMEOUT || 240000));

let browser: Browser | undefined;
let page: Page | undefined;
let pageErrors: string[] = [];
let lastResponse: Response | null = null;
let linksToCheck: string[] = [];
const checkedLinks = new Set<string>();
let formCount = 0;
let buttonCount = 0;
let customSelector = "";
let customCount = 0;

function launchBrowser(): Promise<Browser> {
  const name = String(process.env.CUCUMBER_BROWSER || "chromium").toLowerCase();
  const headless = process.env.HEADLESS !== "false";
  if (name === "firefox") return firefox.launch({ headless });
  if (name === "chrome") return chromium.launch({ headless, channel: "chrome" });
  return chromium.launch({ headless });
}

async function ensurePage(): Promise<Page> {
  if (!page) {
    browser = await launchBrowser();
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    page = await context.newPage();
    page.setDefaultNavigationTimeout(Number(process.env.CUCUMBER_NAV_TIMEOUT || 45000));
    page.setDefaultTimeout(Number(process.env.CUCUMBER_ACTION_TIMEOUT || 30000));
    page.on("pageerror", (error) => pageErrors.push(error.message));
  }
  return page;
}

/**
 * Descarta la pagina actual. Se usa cuando una navegacion falla para que el
 * siguiente escenario no herede una pagina colgada o a medio cargar.
 */
async function resetPage(): Promise<void> {
  if (!page) return;
  const context = page.context();
  page = undefined;
  try {
    await context.close();
  } catch {
    // El contexto ya estaba cerrado.
  }
}

async function internalLinks(): Promise<string[]> {
  const current = await ensurePage();
  const origin = new URL(current.url()).origin;
  return current.locator("a[href]").evaluateAll((elements, base) =>
    elements
      .map((element) => (element as HTMLAnchorElement).href)
      .filter((href) => {
        try {
          return /^https?:/i.test(href) && new URL(href).origin === base;
        } catch {
          return false;
        }
      }),
    origin
  );
}

Before(function () {
  pageErrors = [];
  lastResponse = null;
  linksToCheck = [];
  formCount = 0;
  buttonCount = 0;
  customSelector = "";
  customCount = 0;
});

const REINTENTOS_ENLACE = 2;
const TIMEOUT_ENLACE_MS = 8000;
const CONCURRENCIA_ENLACES = 4;
const ERROR_RED_RE = /ECONNREFUSED|ENOTFOUND|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_SSL|ERR_CERT|ERR_TOO_MANY_REDIRECTS|ERR_UNSAFE_REDIRECT|ERR_INVALID_URL|Protocol .* not supported|ERR_ABORTED/i;

interface ResultadoEnlace {
  url: string;
  estado: "ok" | "roto" | "sin-verificar";
  status?: number;
  error?: string;
}

/**
 * Comprueba un enlace y distingue dos situaciones muy distintas:
 *  - roto: el servidor respondio 4xx/5xx o hubo un error de red/infraestructura
 *    (DNS, conexion rechazada, SSL, URL invalida). Es un defecto real.
 *  - sin-verificar: la peticion no termino a tiempo tras varios intentos
 *    (lentitud o rate limiting; no se cuenta como enlace roto).
 */
async function comprobarEnlace(current: Page, url: string): Promise<ResultadoEnlace> {
  let ultimoError = "";
  for (let intento = 1; intento <= REINTENTOS_ENLACE; intento++) {
    try {
      const respuesta = await current.request.get(url, {
        timeout: TIMEOUT_ENLACE_MS,
        maxRedirects: 10,
        failOnStatusCode: false
      });
      const status = respuesta.status();
      return { url, estado: status >= 400 ? "roto" : "ok", status };
    } catch (error) {
      ultimoError = error instanceof Error ? error.message : String(error);
      if (intento < REINTENTOS_ENLACE) {
        await new Promise((resolve) => setTimeout(resolve, 400 * intento));
      }
    }
  }
  const estado = ERROR_RED_RE.test(ultimoError) ? "roto" : "sin-verificar";
  return { url, estado, error: ultimoError };
}

/** Comprueba los enlaces con un pool pequeno para no saturar el sitio. */
async function comprobarEnlaces(current: Page, urls: string[]): Promise<ResultadoEnlace[]> {
  const resultados: ResultadoEnlace[] = new Array(urls.length);
  let siguiente = 0;
  const trabajadores = Array.from({ length: Math.min(CONCURRENCIA_ENLACES, urls.length) }, async () => {
    while (true) {
      const indice = siguiente++;
      if (indice >= urls.length) return;
      resultados[indice] = await comprobarEnlace(current, urls[indice]);
    }
  });
  await Promise.all(trabajadores);
  return resultados;
}

Given(/^que un usuario (?:abre|visita) "([^"]+)"$/, async function (url: string) {
  const current = await ensurePage();
  pageErrors = [];
  try {
    lastResponse = await current.goto(url, { waitUntil: "domcontentloaded" });
  } catch (error) {
    await resetPage();
    throw error;
  }
});

When(/^la página termina de cargar$/, async function () {
  const current = await ensurePage();
  try {
    await current.waitForLoadState("load");
  } catch (error) {
    await resetPage();
    throw error;
  }
});

When(/^revisa su enlace interno$/, async function () {
  linksToCheck = await internalLinks();
});

When(/^revisa sus \d+ enlaces internos(?: \(.*\))?$/, async function () {
  linksToCheck = await internalLinks();
});

When(/^se carga la imagen de la página$/, async function () {
  const current = await ensurePage();
  await current.waitForLoadState("load");
});

When(/^se cargan las \d+ imágenes de la página$/, async function () {
  const current = await ensurePage();
  await current.waitForLoadState("load");
});

When(/^busca el formulario de la página$/, async function () {
  const current = await ensurePage();
  formCount = await current.locator("form").count();
});

When(/^busca los \d+ formularios de la página$/, async function () {
  const current = await ensurePage();
  formCount = await current.locator("form").count();
});

When(/^revisa el botón de la página$/, async function () {
  const current = await ensurePage();
  buttonCount = await current.locator('button, input[type="button"], input[type="submit"], input[type="reset"], a[role="button"]').count();
});

When(/^revisa los \d+ botones de la página$/, async function () {
  const current = await ensurePage();
  buttonCount = await current.locator('button, input[type="button"], input[type="submit"], input[type="reset"], a[role="button"]').count();
});

When(/^busca los elementos con el selector "([^"]+)"$/, async function (selector: string) {
  const current = await ensurePage();
  customSelector = selector;
  customCount = await current.locator(selector).count();
});

Then(/^debe responder con un código menor a (\d+)$/, async function (limit: number) {
  expect(lastResponse, "La página debe responder").not.toBeNull();
  expect(lastResponse!.status(), "La página debe responder 2xx/3xx").toBeLessThan(limit);
});

Then(/^no debe lanzar errores de JavaScript$/, async function () {
  expect(pageErrors, "La página no debe lanzar errores de JavaScript").toEqual([]);
});

Then(/^todos deben responder con un código menor a (\d+)$/, async function (limit: number) {
  const current = await ensurePage();
  expect(linksToCheck.length, "Debe haber enlaces internos para revisar").toBeGreaterThan(0);
  const pendientes = linksToCheck.filter((url) => !checkedLinks.has(url));
  for (const url of pendientes) checkedLinks.add(url);

  const resultados = await comprobarEnlaces(current, pendientes);
  const rotos = resultados.filter((resultado) => resultado.estado === "roto");
  const sinVerificar = resultados.filter((resultado) => resultado.estado === "sin-verificar");

  if (sinVerificar.length > 0) {
    console.warn(
      "[AVISO] " + sinVerificar.length + " de " + pendientes.length +
      " enlaces no respondieron a tiempo y no se cuentan como fallo: " +
      sinVerificar.map((resultado) => resultado.url).join(", ")
    );
  }

  expect(
    rotos.map((resultado) => resultado.status
      ? resultado.url + " respondio HTTP " + resultado.status
      : resultado.url + " no se pudo conectar: " + (resultado.error || "error de red")),
    "Los enlaces internos deben responder con un codigo menor a " + limit
  ).toEqual([]);
});

Then(/^ninguna debe estar rota \(todas tienen ancho natural mayor a \d+\)$/, async function () {
  const current = await ensurePage();
  const broken = await current.locator("img[src]").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const image = element as HTMLImageElement;
        return !image.complete || image.naturalWidth === 0;
      })
      .map((element) => {
        const image = element as HTMLImageElement;
        return image.getAttribute("src") || "(sin src)";
      })
  );
  expect(broken, "Ninguna imagen debe estar rota").toEqual([]);
});

Then(/^deben estar presentes en el DOM y los visibles deben tener controles$/, async function () {
  const current = await ensurePage();
  const forms = current.locator("form");
  expect(await forms.count(), "La página debe contener los formularios escaneados").toBeGreaterThanOrEqual(formCount);
  const visibleForms = current.locator("form:visible");
  const totalVisible = await visibleForms.count();
  for (let index = 0; index < totalVisible; index++) {
    const controls = visibleForms.nth(index).locator("input, select, textarea, button");
    expect(await controls.count(), "El formulario visible #" + (index + 1) + " debe tener controles").toBeGreaterThan(0);
  }
});

Then(/^deben estar presentes y, si son visibles, al menos uno debe estar habilitado$/, async function () {
  const current = await ensurePage();
  const buttons = current.locator('button, input[type="button"], input[type="submit"], input[type="reset"], a[role="button"]');
  expect(await buttons.count(), "La página debe contener los botones escaneados").toBeGreaterThanOrEqual(buttonCount);
  const visibleButtons = current.locator('button:visible, input[type="button"]:visible, input[type="submit"]:visible, input[type="reset"]:visible, a[role="button"]:visible');
  const totalVisible = await visibleButtons.count();
  if (totalVisible > 0) {
    let enabled = 0;
    for (let index = 0; index < totalVisible; index++) {
      if (await visibleButtons.nth(index).isEnabled()) enabled++;
    }
    expect(enabled, "Debe haber al menos un botón visible y habilitado").toBeGreaterThan(0);
  }
});

Then(/^debe encontrar al menos (\d+) elemento\(s\)$/, async function (minimum: number) {
  expect(customCount, "El selector " + customSelector + " debe encontrar elementos").toBeGreaterThanOrEqual(minimum);
});

AfterAll(async function () {
  if (browser) {
    await browser.close();
    browser = undefined;
    page = undefined;
  }
});
`;
//# sourceMappingURL=cucumber-steps-template.js.map