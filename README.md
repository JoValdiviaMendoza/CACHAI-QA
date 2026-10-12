# CACHAI-QA

## Nombre del Proyecto

**CACHAI-QA** (*Comprehensive Automated Checks & Headless Assertions Infrastructure*) — DUOC Alameda

## Descripción

El proyecto denominado **CACHAI-QA** consiste en desarrollar un framework de automatización de pruebas innovador con un enfoque **"Plug & Play"** ("listo para usar"). Su objetivo principal es que el usuario solo tenga que ingresar la URL de una página web en un archivo de configuración. A partir de ahí, el sistema escanea automáticamente el sitio (identificando enlaces, imágenes y formularios) y genera pruebas genéricas para el Front-End. Estas pruebas verifican reglas universales de calidad, como la ausencia de enlaces rotos, la correcta carga de imágenes, errores de sistema ocultos y el funcionamiento de los botones principales, ejecutando escenarios descritos en lenguaje natural.

**Nota:** este repositorio reúne la **documentación** del proyecto (Fase 1 y Fase 2). El código del framework se gestiona por separado y aún no está publicado, por lo que las instrucciones de ejecución de más abajo son **referenciales**.

## Tecnologías Utilizadas

### Lenguajes de programación

- **TypeScript** — Lenguaje principal estructurado y tipado, utilizado para desarrollar la lógica del framework, los algoritmos de escaneo y la redacción de las aserciones.
- **Node.js** — Entorno de ejecución necesario para compilar TypeScript y ejecutar el framework y sus herramientas.

### Frameworks y librerías

- **Playwright** — Framework central de automatización empleado para controlar los navegadores, realizar el escaneo automático del Front-End, interceptar elementos dinámicos y ejecutar las pruebas de manera ágil.
- **Gherkin / BDD** — Redacción de los escenarios de prueba en lenguaje natural.
- **Page Object Model (POM)** — Patrón de diseño para la organización y reutilización de los componentes de prueba.

### Cloud / Infraestructura

- **BrowserStack** — Plataforma en la nube prevista para ejecutar y centralizar las revisiones de forma remota en distintos navegadores, generando un panel visual de reportes y grabaciones en video. *(Integración planificada para la etapa de estabilización; aún no implementada.)*

### Navegadores objetivo de prueba

- **Chromium** — Navegador utilizado actualmente para la ejecución local de las pruebas.
- **Google Chrome**, **Mozilla Firefox** y **Apple Safari** — Objetivo de validación cross-browser, planificado mediante BrowserStack.

> Nota: Firefox no puede ejecutarse localmente debido a una política de seguridad de Windows, por lo que en la práctica se utiliza **Chromium** como navegador alternativo.

## Instrucciones para Ejecutar el Proyecto Localmente

### Requisitos previos

- Instalación de **Node.js** (entorno de ejecución necesario para compilar TypeScript y ejecutar Playwright).
- Gestor de paquetes de Node instalado (por ejemplo, `npm`, `yarn` o `pnpm`).
- Para la ejecución **local** con Chromium **no se requieren credenciales externas**. Las credenciales de **BrowserStack** solo son necesarias para la ejecución **en la nube** (etapa final, planificada).

### Instalación

1. Clonar el repositorio del proyecto en el entorno local.
2. Abrir la terminal en la raíz del proyecto y ejecutar el comando de instalación de dependencias (`npm install`) para descargar las librerías necesarias de TypeScript y Playwright.
3. Instalar el navegador que utiliza Playwright: `npx playwright install chromium`.

### Configuración

1. Crear o modificar el archivo de configuración inicial del framework (por ejemplo, un archivo `.env` o `config.ts`).
2. Ingresar obligatoriamente la URL exacta de la página web que se desea escanear y evaluar (`TARGET_URL`).
3. Para la ejecución en la nube, ingresar las credenciales correspondientes a la cuenta de **BrowserStack** (`BROWSERSTACK_USERNAME` y `BROWSERSTACK_ACCESS_KEY`).

### Ejecución

1. Ejecutar el comando principal de inicio de pruebas por consola (por ejemplo, `npx playwright test` o un script personalizado).
2. El framework abrirá la dirección web configurada y realizará un escaneo automático de sus elementos principales (enlaces, imágenes, áreas interactivas).
3. El sistema generará los escenarios genéricos y los ejecutará de forma local con Chromium (y, en la etapa final, de forma remota en la nube mediante **BrowserStack**).

### Acceso a resultados

1. Una vez finalizado el proceso, el **panel web local** del framework muestra el resumen de los escaneos y los resultados de las pruebas (aprobadas/rechazadas) junto con el registro de errores.
2. En la etapa cloud (planificada), el sistema entregará además un enlace hacia el panel visual de **BrowserStack** para revisar el reporte detallado con los videos de las revisiones.

## Integrantes del Equipo

| Nombre | Rol |
|---|---|
| Alex Puebla | Analista QA - Líder de estrategias de pruebas |
| José Valdivia | Ingeniero Analista QA - Líder infraestructura en la nube |

## Metodología de Trabajo del Equipo

El equipo gestiona el desarrollo del proyecto utilizando el framework ágil **Scrum**, adaptado a las necesidades académicas y técnicas del Capstone. Las principales prácticas implementadas son:

- **Gestión del Backlog**: Los requerimientos se estructuran mediante Épicas (ej. Configuración Inicial, Escaneo Automático) que se desglosan en Historias de Usuario escritas en lenguaje natural ("Como... quiero... para...").
- **Definición de Terminado (DoD)**: Cada historia cuenta con Criterios de Aceptación claros (negocio y técnicos) que deben cumplirse para ser considerada finalizada.
- **Estimación**: Se utiliza la ceremonia de *Poker Planning* para dimensionar el esfuerzo técnico de cada Épica, cuantificándolo en Puntos de Función (PF).
- **Iteraciones**: El ciclo de vida del desarrollo se divide en un plan de trabajo iterativo e incremental, con el desarrollo concentrado entre las semanas 5 y 14 del semestre.
- **Control de versiones**: Se utiliza Git/GitHub como fuente única de verdad del código y de la documentación, con revisión por pares.

## Arquitectura de la Solución

La arquitectura se compone de los siguientes módulos interconectados:

1. **Módulo de Configuración local**: Archivo o script inicial donde el usuario proporciona la URL a evaluar y, en la etapa cloud, las credenciales de acceso.
2. **Motor de Escaneo (Playwright Scraper)**: Componente basado en Playwright que lanza un navegador (headless o con interfaz), navega a la URL objetivo, identifica el árbol de elementos (DOM) y almacena enlaces, imágenes y formularios temporalmente.
3. **Generador de Pruebas (TypeScript + Core)**: Motor lógico desarrollado en TypeScript que toma los elementos recolectados y genera dinámicamente aserciones basadas en reglas de negocio universales (lenguaje natural/BDD).
4. **Integración Cloud (Playwright to BrowserStack)**: Módulo de conexión que delega la ejecución de las pruebas a la nube de BrowserStack, permitiendo testing cruzado en Chrome, Firefox y Safari sin consumir recursos locales del usuario. *(Planificado.)*
5. **Dashboard Visual de Reportes**: Entorno final que recopila los resultados, logs y videos de las pruebas, presentando el estado de salud de la URL en una interfaz amigable. *(Hoy implementado como panel web local; se complementará con el panel de BrowserStack en la etapa final.)*
