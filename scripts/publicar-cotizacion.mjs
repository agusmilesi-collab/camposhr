/**
 * Publica una cotización: copia el HTML de la propuesta a public/q/<token>.html
 * y le agrega lo que necesita para vivir en la web.
 *
 *   node scripts/publicar-cotizacion.mjs <html-origen> <token> "<Cliente>"
 *
 * Qué le agrega al documento:
 *   1. noindex, para que el enlace secreto no lo levante ningún buscador.
 *   2. Las dos acciones del cliente: descargar el archivo y guardarlo en PDF.
 *      Sin librerías: la descarga es el propio HTML y el PDF lo genera el
 *      navegador al imprimir, así que la página no pesa un byte más.
 *
 * Es idempotente: si el documento ya tiene el bloque, lo reemplaza.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [origen, tokenArg, clienteArg] = process.argv.slice(2);

if (!origen || !tokenArg) {
  console.error(
    'Uso: node scripts/publicar-cotizacion.mjs <html-origen> <token> "<Cliente>"'
  );
  process.exit(1);
}

if (!/^[A-Za-z0-9_-]{6,128}$/.test(tokenArg)) {
  console.error(
    `Token inválido: "${tokenArg}". Solo letras, números, guion y guion bajo (6 a 128).`
  );
  process.exit(1);
}

const cliente = clienteArg ?? 'Campos HR';
const nombreArchivo = `Propuesta Campos HR - ${cliente}.html`.replace(
  /[/\\?%*:|"<>]/g,
  '-'
);

const MARCA_INICIO = '<!-- chr:acciones -->';
const MARCA_FIN = '<!-- /chr:acciones -->';

const bloque = `${MARCA_INICIO}
<style>
  .chr-acciones {
    position: fixed;
    right: 18px;
    bottom: 18px;
    display: flex;
    gap: 8px;
    z-index: 60;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }
  .chr-btn {
    font: inherit;
    font-size: 0.82rem;
    line-height: 1;
    color: #16202b;
    background: #ffffff;
    border: 1px solid #e5e2db;
    border-radius: 8px;
    padding: 10px 15px;
    text-decoration: none;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(22, 32, 43, 0.08);
    transition: border-color 0.12s, box-shadow 0.12s;
  }
  .chr-btn:hover {
    border-color: #c9c4ba;
    box-shadow: 0 2px 8px rgba(22, 32, 43, 0.12);
  }
  @media print {
    .chr-acciones { display: none !important; }
  }
  @media (max-width: 640px) {
    .chr-acciones { right: 12px; bottom: 12px; }
    .chr-btn { padding: 9px 12px; font-size: 0.78rem; }
  }
</style>
<div class="chr-acciones" role="group" aria-label="Acciones del documento">
  <a class="chr-btn" href="/q/${tokenArg}.html" download="${nombreArchivo}">Descargar</a>
  <button class="chr-btn" type="button" onclick="window.print()">Guardar en PDF</button>
</div>
${MARCA_FIN}`;

const rutaOrigen = resolve(origen);
const rutaDestino = resolve(
  process.cwd(),
  'public',
  'q',
  `${tokenArg}.html`
);

let html = await readFile(rutaOrigen, 'utf8');

// 1) noindex
if (!/name=["']robots["']/i.test(html)) {
  html = html.replace(
    /<head>/i,
    '<head>\n  <meta name="robots" content="noindex, nofollow" />'
  );
}

// 2) acciones del cliente (reemplaza el bloque anterior si ya estaba)
const yaTiene = html.indexOf(MARCA_INICIO);
if (yaTiene !== -1) {
  const fin = html.indexOf(MARCA_FIN) + MARCA_FIN.length;
  html = html.slice(0, yaTiene) + bloque + html.slice(fin);
} else if (/<\/body>/i.test(html)) {
  html = html.replace(/<\/body>/i, `${bloque}\n</body>`);
} else {
  html += `\n${bloque}\n`;
}

await mkdir(dirname(rutaDestino), { recursive: true });
await writeFile(rutaDestino, html, 'utf8');

console.log(`Publicada: public/q/${tokenArg}.html`);
console.log(`Enlace:    https://camposhr.com/q/${tokenArg}`);
console.log(`Descarga:  ${nombreArchivo}`);
console.log('Falta sumar la fila en data/cotizaciones.json y hacer deploy.');
