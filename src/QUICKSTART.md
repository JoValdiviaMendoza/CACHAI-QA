# CACHAI-QA - Quick Start: Crawler Simple

## 🚀 Instalación Rápida

```bash
# 1. Entrar al directorio
cd cachai-qa

# 2. Instalar dependencias
npm install

# 3. Instalar navegadores de Playwright
npx playwright install chromium
```

## 🕷️ Uso del Crawler (Plug & Play)

### Básico - Solo URL
```bash
npm run crawl -- --url=https://ejemplo.com
```

### Con opciones
```bash
# Profundidad 2, máximo 100 páginas, modo visible (headed)
npm run crawl -- --url=https://ejemplo.com --depth=2 --max-pages=100 --headless=false

# Verbose + delay personalizado + archivo de salida
npm run crawl -- -u https://ejemplo.com -d 2 -m 50 -v --delay=1000 -o ./mis-resultados.json
```

### Opciones disponibles

| Opción | Alias | Default | Descripción |
|--------|-------|---------|-------------|
| `--url` | `-u` | **requerido** | URL inicial a rastrear |
| `--depth` | `-d` | `1` | Profundidad de rastreo (0 = solo URL inicial) |
| `--max-pages` | `-m` | `50` | Máximo de páginas a visitar |
| `--headless` | | `true` | `false` para ver el navegador |
| `--output` | `-o` | `./crawl-results.json` | Archivo JSON de salida |
| `--verbose` | `-v` | `false` | Log detallado en consola |
| `--delay` | | `500` | ms entre requests |

## 📊 Salida

El script genera un archivo JSON con:

```json
{
  "baseUrl": "https://ejemplo.com",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "totalPages": 12,
  "totalLinks": 247,
  "links": [
    {
      "url": "https://ejemplo.com/about",
      "text": "Sobre nosotros",
      "isInternal": true,
      "parentUrl": "https://ejemplo.com",
      "depth": 1
    }
  ],
  "errors": []
}
```

## 🔧 Ejemplos Prácticos

```bash
# Solo página principal (rápido)
npm run crawl -- --url=https://miweb.com --depth=0

# Sitio completo pequeño
npm run crawl -- --url=https://blog.ejemplo.com --depth=2 --max-pages=30

# Debug visual (ver navegador)
npm run crawl:headed -- --url=https://ejemplo.com --depth=1 --verbose
```

## 📝 Requisitos

- Node.js 18+
- npm / pnpm / yarn

## ⚠️ Notas

- Respeta `robots.txt` básico
- Ignora automáticamente: PDFs, ZIPs, mailto:, tel:, anclas #
- Delay por defecto 500ms entre requests (educado con el servidor)
- Solo sigue enlaces **internos** (mismo dominio)