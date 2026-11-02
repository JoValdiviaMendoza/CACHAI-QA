/**
 * Plantilla de pasos Cucumber que se copia a reports/generated-tests/cachai-steps.ts
 * cada vez que se generan pruebas desde un escaneo (opción 4).
 *
 * Los pasos coinciden con el Gherkin en español que produce cli/from-scan.ts.
 * Se usa String.raw para conservar las expresiones regulares (\d, \s, etc.).
 */
export const CUCUMBER_STEPS_TEMPLATE = String.raw`import { AfterAll, Before, Given, Then, When, setDefaultTimeout } from "@cucumber/cucumber";
import { chromium, expect } from "@playwright/test";
import type { Browser, Page, Response } from "playwright";

setDefaultTimeout(Number(process.env.CUCUMBER_TIMEOUT || 120000));

let browser: Browser | undefined;
let page: Page | undefined;
let pageErrors: string[] = [];
let lastResponse: Response | null = null;
let linksToCheck: string[] = [];
let formCount = 0;
let buttonCount = 0;
let customSelector = "";
let customCount = 0;

async function ensurePage(): Promise<Page> {
  if (!page) {
    browser = await chromium.launch({ headless: process.env.HEADLESS !== "false" });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
  }
  return page;
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

Given(/^que un usuario (?:abre|visita) "([^"]+)"$/, async function (url: string) {
  const current = await ensurePage();
  pageErrors = [];
  lastResponse = await current.goto(url, { waitUntil: "domcontentloaded" });
});

When(/^la página termina de cargar$/, async function () {
  const current = await ensurePage();
  await current.waitForLoadState("load");
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
  for (const url of linksToCheck) {
    const response = await current.request.get(url, { timeout: 20000, maxRedirects: 10 });
    expect(response.status(), "El enlace " + url + " debe responder sin errores").toBeLessThan(limit);
  }
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

Then(/^todos deben estar presentes y visibles para el usuario$/, async function () {
  const current = await ensurePage();
  const forms = current.locator("form");
  expect(await forms.count(), "La página debe contener los formularios escaneados").toBeGreaterThanOrEqual(formCount);
  for (let index = 0; index < formCount; index++) {
    await expect(forms.nth(index), "El formulario #" + (index + 1) + " debe ser visible").toBeVisible();
  }
});

Then(/^todos deben ser visibles y estar habilitados$/, async function () {
  const current = await ensurePage();
  const buttons = current.locator('button, input[type="button"], input[type="submit"], input[type="reset"], a[role="button"]');
  expect(await buttons.count(), "La página debe contener los botones escaneados").toBeGreaterThanOrEqual(buttonCount);
  for (let index = 0; index < buttonCount; index++) {
    await expect(buttons.nth(index), "El botón #" + (index + 1) + " debe ser visible").toBeVisible();
    await expect(buttons.nth(index), "El botón #" + (index + 1) + " debe estar habilitado").toBeEnabled();
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
