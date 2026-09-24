# capstone_2026_duoc_alameda

## Nombre del Proyecto

**CACHAI-QA** (*Comprehensive Automated Checks & Headless Assertions Infrastructure*) — DUOC Alameda

## Descripción

El proyecto denominado **CACHAI-QA** consiste en desarrollar un framework de automatización de pruebas innovador con un enfoque **"Plug & Play"** ("listo para usar"). Su objetivo principal es que el usuario solo tenga que ingresar la URL de una página web en un archivo de configuración. A partir de ahí, el sistema escanea automáticamente el sitio (identificando enlaces, imágenes y formularios) y genera pruebas genéricas para el Front-End. Estas pruebas verifican reglas universales de calidad, como la ausencia de enlaces rotos, la correcta carga de imágenes, errores de sistema ocultos y el funcionamiento de los botones principales, ejecutando escenarios descritos en lenguaje natural.

## Tecnologías Utilizadas

### Lenguajes de programación

- **TypeScript** — Lenguaje principal estructurado y tipado, utilizado para desarrollar la lógica del framework, los algoritmos de escaneo y la redacción de las aserciones.

### Frameworks y librerías

- **Playwright** — Framework central de automatización empleado para controlar los navegadores, realizar el escaneo automático del Front-End, interceptar elementos dinámicos y ejecutar las pruebas de manera ágil.
- **Page Object Model (POM)** — Organización y reutilización de componentes de prueba.

### Cloud / Infraestructura

- **BrowserStack** — Plataforma en la nube utilizada para ejecutar y centralizar las revisiones de forma remota en distintos navegadores, generando un panel visual de reportes y grabaciones en video.

### Navegadores objetivo de prueba

- Google Chrome
- Mozilla Firefox

## Instrucciones para Ejecutar el Proyecto Localmente

### Requisitos previos

- Instalación de **Node.js** (entorno de ejecución necesario para compilar TypeScript y ejecutar Playwright).
- Gestor de paquetes de Node instalado (por ejemplo, `npm`, `yarn` o `pnpm`).
- Credenciales activas y configuración segura para permitir la conexión remota con la plataforma **BrowserStack**.

### Instalación

1. Clonar el repositorio del proyecto (`capstone_2026_duoc_alameda`) en el entorno local.
2. Abrir la terminal en la raíz del proyecto y ejecutar el comando de instalación de dependencias (ej. `npm install`) para descargar las librerías necesarias de TypeScript y Playwright.

### Configuración

1. Crear o modificar el archivo de configuración inicial del framework (por ejemplo, un archivo `.env` o `config.ts`).
2. Ingresar obligatoriamente la URL exacta de la página web que se desea escanear y evaluar.
3. Ingresar las llaves de acceso o tokens correspondientes a la cuenta de **BrowserStack**.

### Ejecución

1. Ejecutar el comando principal de inicio de pruebas por consola (por ejemplo, `npx playwright test` o un script personalizado como `npm run test:cachai`).
2. El framework abrirá la dirección web configurada y realizará un escaneo automático de sus elementos principales (enlaces, imágenes, áreas interactivas).
3. El sistema generará los escenarios genéricos y enviará de forma invisible las instrucciones hacia **BrowserStack** para ejecutarse en múltiples navegadores en la nube.

### Acceso a resultados

1. Una vez finalizado el proceso, el sistema entregará un enlace hacia el panel visual de BrowserStack.
2. Ingresar a la URL proporcionada para revisar el reporte detallado con las pruebas que pasaron o fallaron, incluyendo el registro de errores y los videos de las revisiones.

## Integrantes del Equipo

| Nombre | Rol |
|---|---|
| Alex Puebla | Analista QA - Líder de estrategias de pruebas |
| Jose Valdivia | Ingeniero Analista QA - Líder infraestructura en la nube |

## Metodología de Trabajo del Equipo

El equipo gestiona el desarrollo del proyecto utilizando el framework ágil **Scrum**, adaptado a las necesidades académicas y técnicas del Capstone. Las principales prácticas implementadas son:

- **Gestión del Backlog**: Los requerimientos se estructuran mediante Épicas (ej. Configuración Inicial, Escaneo Automático) que se desglosan en Historias de Usuario escritas en lenguaje natural ("Como... quiero... para...").
- **Definición de Terminado (DoD)**: Cada historia cuenta con Criterios de Aceptación claros que deben cumplirse para ser considerada finalizada.
- **Estimación**: Se utiliza la ceremonia de *Poker Planning* para dimensionar el esfuerzo técnico de cada Épica, cuantificándolo en Puntos de Función (PF).
- **Iteraciones**: El ciclo de vida del desarrollo se divide en un plan de trabajo iterativo e incremental distribuido en 10 semanas (Sprints/Fases).

## Arquitectura de la Solución

La arquitectura se compone de los siguientes módulos interconectados:

1. **Módulo de Configuración local**: Archivo o script inicial donde el usuario proporciona la URL a evaluar y los tokens de acceso.
2. **Motor de Escaneo (Playwright Scraper)**: Componente basado en Playwright que lanza un navegador (headless o con interfaz), navega a la URL objetivo, identifica el árbol de elementos (DOM) y almacena enlaces, imágenes y formularios temporalmente.
3. **Generador de Pruebas (TypeScript + Core)**: Motor lógico desarrollado en TypeScript que toma los elementos recolectados y genera dinámicamente aserciones basadas en reglas de negocio universales (lenguaje natural/BDD).
4. **Integración Cloud (Playwright to BrowserStack)**: Módulo de conexión que delega la ejecución de las pruebas a la nube de BrowserStack, permitiendo testing cruzado en Chrome y Firefox sin consumir recursos locales del usuario.
5. **Dashboard Visual de Reportes**: Entorno final en BrowserStack que recopila los resultados, logs y videos de Playwright, presentando el estado de salud de la URL en una interfaz amigable.
