#!/usr/bin/env node
'use strict';

/**
 * CACHAI-QA - Servidor de la pagina de ejemplo (demo)
 * Sirve la carpeta demo/ por HTTP para poder escanearla con el crawler.
 *
 * Uso: node demo/serve.js   (o npm run demo)
 * Puerto: 8099 (configurable con DEMO_PORT)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = parseInt(process.env.DEMO_PORT, 10) || 8099;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    pathname = '/';
  }
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const full = path.resolve(ROOT, '.' + pathname);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<!doctype html><meta charset="utf-8"><h1>404</h1><p>No encontrado: ' + pathname + '</p>');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('El puerto ' + PORT + ' ya esta en uso. Cierra el otro servidor o define DEMO_PORT.');
    process.exit(1);
  }
  console.error('Error del servidor demo:', err.message);
  process.exit(1);
});

server.listen(PORT, () => {
  const url = 'http://localhost:' + PORT + '/';
  console.log('');
  console.log('  ============================================================');
  console.log('   CACHAI-QA - Pagina de ejemplo (demo)');
  console.log('  ============================================================');
  console.log('   Ver en el navegador: ' + url);
  console.log('   Para escanear usa la URL: localhost:' + PORT);
  console.log('   Cierra esta ventana para detener el servidor.');
  console.log('  ============================================================');
  console.log('');
});
