# CACHAI-QA

## Nombre del Proyecto

**CACHAI-QA** (*Comprehensive Automated Checks & Headless Assertions Infrastructure*) — DUOC Alameda

## Descripción

**CACHAI-QA** es un framework de automatización de pruebas con enfoque **“Plug & Play”**. El usuario ingresa una URL y el sistema:

1. escanea el sitio;
2. identifica enlaces, imágenes, formularios y botones;
3. genera escenarios genéricos en lenguaje natural;
4. ejecuta las pruebas con Playwright y/o Cucumber;
5. entrega reportes HTML, JSON y Markdown, junto con un dashboard local.

El objetivo es reducir la barrera de entrada a la automatización para PYMES, emprendedores, analistas QA y equipos que no tienen un área de QA dedicada.

**Nota:** el repositorio reúne la documentación de Fase 1 y Fase 2, y el código del framework en `src/`. Las instrucciones de ejecución se aplican desde esa carpeta.

## Estado actual

CACHAI-QA se encuentra en un **MVP funcional local** y cuenta con un workflow de **GitHub Actions** para ejecución remota.

| Área | Estado |
|---|---|
| Escaneo, generación y ejecución local | ✅ Operativo |
| Playwright + Cucumber | ✅ Operativo |
| Reportes HTML/JSON/Markdown | ✅ Operativo |
| Dashboard local | ✅ Operativo |
| Auditoría local desde el dashboard | ✅ Operativo |
| GitHub Actions | ✅ Validado con ejecución en GitHub |
| BrowserStack / Safari | ✅ Implementado; requiere credenciales reales para la ejecución end-to-end |
| Informe final consolidado | 🟡 Pendiente |

El repositorio se organiza en `Fase 1/`, `Fase 2/`, `src/` y este `README.md`. La configuración de CI vive en `.github/workflows/qa.yml`.

## Tecnologías Utilizadas

### Lenguajes de programación

- **TypeScript** — Lógica del crawler, generación de pruebas, tipado y utilidades del framework.
- **Node.js 22+** — Entorno de ejecución del framework, Playwright, Cucumber y el dashboard.

### Frameworks y librerías

- **Playwright** — Navegación, escaneo del DOM y ejecución de pruebas en navegadores.
- **Gherkin / BDD** — Escenarios en lenguaje natural.
- **Cucumber** — Ejecución de los escenarios BDD y generación de reportes.
- **Page Object Model (POM)** — Patrón de referencia. **Estado:** el flujo actual genera un spec único con `test.describe` por página y helpers; no existe una capa formal de Page Objects. Se considera una mejora futura, no un requisito del MVP.

### Cloud / Infraestructura

- **GitHub Actions** — Workflow manual de escaneo, generación, ejecución y publicación de artefactos.
- **BrowserStack** — Ejecución cloud de Playwright en Chrome, Firefox y WebKit/Safari. **Estado:** implementado; solo requiere usuario y access key.

### Navegadores objetivo de prueba

- **Chromium**, **Google Chrome** y **Mozilla Firefox** — ejecución local configurada.
- **Apple Safari** — ejecución remota mediante BrowserStack/WebKit.

> Chrome utiliza el navegador instalado en el sistema. Si no está disponible, se puede ejecutar solo con Chromium y Firefox mediante `--browsers=chromium,firefox`.

## Instrucciones para Ejecutar el Proyecto Localmente

### Requisitos previos

Para el usuario final:

- Windows 10/11.
- Conexión a Internet.
- No necesita saber programar ni usar comandos: el flujo principal es el menú `cachai-qa.bat`.

Para el flujo técnico:

- **Node.js 22+**.
- `npm`, `pnpm` o `yarn`.
- Git/Git Bash solo si se clona el repositorio.
- Para GitHub Actions se necesita un token de GitHub.
- Para BrowserStack se necesitan credenciales de la cuenta.

### Instalación para usuario final

1. Entrar al repositorio en GitHub.
2. Presionar **Code → Download ZIP**.
3. Descomprimir el archivo.
4. Abrir la carpeta `src`.
5. Hacer doble clic en `cachai-qa.bat`.
6. Elegir la opción **[8] Verificar / Instalar dependencias**.
7. Elegir la opción **[7] Configurar .env** e ingresar la URL.
8. Volver al menú y usar:
   - **[1] Scan rápido**;
   - **[2] Scan completo**;
   - **[3] Scan personalizado**;
   - **[4] Generar / Ejecutar tests**;
   - **[5] Panel web**.

La opción **[8]** instala o verifica Node.js, dependencias, Playwright y Cucumber. No es necesario ejecutar `npm ci` manualmente.

### Instalación con Git Bash

Si el usuario prefiere clonar:

```bash
git clone https://github.com/JoValdiviaMendoza/CACHAI-QA.git
cd CACHAI-QA/src
```

Luego abrir el menú:

```bash
./cachai-qa.bat
```

Si Git Bash no ejecuta el `.bat` directamente:

```bash
cmd //c cachai-qa.bat
```

Después usar la opción **[8]** para instalar dependencias y la opción **[7]** para configurar `.env`.

### Instalación avanzada para desarrolladores

Solo si se necesita trabajar desde la CLI:

```bash
cd src
npm ci
npx playwright install chromium firefox
```

Chrome utiliza la instalación del sistema.

### Configuración

La forma recomendada para el usuario final es la opción **[7] Configurar .env** del menú.

También se puede editar manualmente `src/.env`.

Variables mínimas:

```env
TARGET_URL=https://ejemplo.com
CRAWL_DEPTH=1
MAX_PAGES=50
HEADLESS=true
```

Variables opcionales para GitHub Actions:

```env
GITHUB_REPO=JoValdiviaMendoza/CACHAI-QA
GITHUB_TOKEN=github_pat_...
GITHUB_WORKFLOW=qa.yml
GITHUB_CI_REF=main
GITHUB_CI_AUTO_IMPORT=true
```

BrowserStack solo necesita estas dos variables (opcionales):

```env
BROWSERSTACK_USERNAME=...
BROWSERSTACK_ACCESS_KEY=...
```

El proyecto, la build, los navegadores (Chrome, Firefox y WebKit/Safari) y el túnel para `localhost` se configuran automáticamente. BrowserStack aplica a Playwright; Cucumber se ejecuta local. Después de editar `.env`, reinicia el dashboard para que lea las credenciales.

### Ejecución

#### Camino recomendado para usuario final

```text
Abrir src/cachai-qa.bat
→ [8] instalar dependencias
→ [7] configurar URL en .env
→ [1], [2] o [3] para escanear
→ [4] para generar/ejecutar pruebas (local o BrowserStack si hay credenciales)
→ [5] para abrir el dashboard
```

No se requieren comandos ni conocimientos de programación.

#### Opción 1: menú local

Abrir:

```text
src/cachai-qa.bat
```

Opciones principales:

1. Scan rápido
2. Scan completo
3. Scan personalizado
4. Generar/ejecutar tests
5. Panel web
6. Página de demostración
7. Configurar `.env`
8. Verificar/instalar dependencias

#### Opción 2: CLI

Escanear:

```bash
npx ts-node crawler.ts --url=https://ejemplo.com --type=all --depth=2 --max-pages=50
```

Generar y ejecutar Playwright:

```bash
npx ts-node cli/from-scan.ts --scan=scan-report/archivo.json --run
```

Ejecutar Playwright en BrowserStack (solo con credenciales en `.env`):

```bash
npx ts-node cli/from-scan.ts --scan=scan-report/archivo.json --run --browserstack
```

Ejecutar Cucumber:

```bash
npx cucumber-js --config cucumber.js
```

Generar reporte de defectos:

```bash
node cli/report-defects.js both --scan=scan-report/archivo.json
```

#### Opción 3: auditoría local desde el dashboard

En **Escaneos** existe un formulario para ingresar una URL y ejecutar:

- crawler rápido, completo o personalizado;
- generación de pruebas;
- Playwright local o en BrowserStack;
- Cucumber local;
- reportes.

El selector **Entorno** se habilita automáticamente cuando existen las credenciales de BrowserStack.

Incluye estado en vivo, log y botón **Cancelar**.

#### Opción 4: GitHub Actions

El workflow está en:

```text
.github/workflows/qa.yml
```

Se ejecuta manualmente desde **Actions → CACHAI-QA QA Pipeline**. Permite configurar URL, elementos, profundidad, páginas, motor y navegadores. Publica `scan` y `reports` como artefactos.

El dashboard incluye una pestaña **GitHub Actions** para:

- configurar los inputs del workflow;
- listar ejecuciones;
- ejecutar el workflow remotamente;
- importar la última corrida;
- revisar los errores del reporte importado.

> El workflow debe estar en `main` para que `workflow_dispatch` esté disponible. El dashboard requiere `GITHUB_TOKEN`. No uses `localhost` como URL remota: GitHub Actions no puede acceder a tu PC; usa una URL pública o un túnel.

### Acceso a resultados

- Reporte HTML de Playwright: `reports/playwright-report-*/index.html`.
- Reporte HTML/JSON de Cucumber: `reports/cucumber/`.
- Métricas Playwright: `reports/results.json`.
- Métricas BDD: `reports/bdd-metrics.json`.
- Defectos: `reports/defectos-<host>-<fecha>.md`.
- Scans: `scan-report/`.

El dashboard local muestra:

- **Inicio:** salud general y errores.
- **Escaneos:** rápidos, completos, personalizados, automatizados y favoritos.
- **Ejecuciones:** historial Playwright/Cucumber y detalle de errores.
- **GitHub Actions:** ejecuciones remotas, configuración, importación, historial de reportes, eliminación y detalle de errores.
- **Auditoría local:** barra de avance, estado por etapa, log y cancelación.

Los scans locales se nombran como:

```text
<host>-<modo>-<fecha>.json
```

Los scans importados desde GitHub Actions:

```text
github-actions-<host>-<runId>.json
```

## Integrantes del Equipo

| Nombre | Rol |
|---|---|
| Alex Puebla | Analista QA - Líder de estrategias de pruebas |
| José Valdivia | Ingeniero Analista QA - Líder de infraestructura en la nube |

## Metodología de Trabajo del Equipo

El equipo gestiona el desarrollo del proyecto utilizando el framework ágil **Scrum**, adaptado a las necesidades académicas y técnicas del Capstone. Las principales prácticas implementadas son:

- **Gestión del Backlog:** los requerimientos se estructuran mediante épicas que se desglosan en Historias de Usuario escritas en lenguaje natural.
- **Definición de Terminado (DoD):** cada historia cuenta con criterios de aceptación de negocio y técnicos.
- **Estimación:** se utiliza *Poker Planning* para dimensionar el esfuerzo técnico.
- **Iteraciones:** el desarrollo se organiza de forma iterativa e incremental.
- **Control de versiones:** Git/GitHub como fuente única de verdad del código y la documentación, con revisión por pares.

## Arquitectura de la Solución

1. **Configuración local:** `.env`, validación de URL y perfiles de ejecución.
2. **Motor de escaneo:** crawler basado en Playwright que extrae enlaces, imágenes, formularios y botones.
3. **Generador de pruebas:** convierte el scan JSON en un spec de Playwright y escenarios Gherkin/Cucumber.
4. **Ejecución local:** Playwright en Chromium/Chrome/Firefox y Cucumber en Chromium.
5. **Integración cloud:** Playwright en BrowserStack (Chrome, Firefox y WebKit/Safari), con túnel automático para sitios locales.
6. **Reportes y dashboard:** consolida resultados, errores y defectos en HTML, JSON, Markdown y panel local.
7. **CI/CD:** workflow de GitHub Actions con jobs de escaneo, pruebas y publicación de artefactos.
