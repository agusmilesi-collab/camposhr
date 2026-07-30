/**
 * Publica una cotización: copia el HTML de la propuesta a public/q/<token>.html
 * y le agrega lo que necesita para vivir en la web.
 *
 *   node scripts/publicar-cotizacion.mjs <html-origen> <token> "<Cliente>"
 *
 * Qué le agrega al documento:
 *   1. noindex, para que el enlace secreto no lo levante ningún buscador.
 *   2. Dos barras de acciones, una arriba y otra al final: descargar el archivo
 *      y guardarlo en PDF. La de arriba avisa que se puede guardar antes de
 *      empezar a leer; la de abajo lo deja a mano al terminar, y suma "Ir
 *      arriba". Sin librerías: la descarga es el propio HTML y el PDF lo arma
 *      el navegador al imprimir, así que el documento no pesa un byte más.
 *
 * Es idempotente: si el documento ya tiene los bloques, los reemplaza.
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

const A = '<!-- chr:acciones -->';
const A_FIN = '<!-- /chr:acciones -->';
const B = '<!-- chr:acciones-fin -->';
const B_FIN = '<!-- /chr:acciones-fin -->';

const estilos = `<style>
  .chr-barra {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin: 26px 0 30px;
    padding: 14px 0;
    border-top: 1px solid var(--line, #e5e2db);
    border-bottom: 1px solid var(--line, #e5e2db);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }
  .chr-barra-fin {
    margin-bottom: 44px;
  }
  /* Respaldo por si el documento no define su propio contenedor centrado. */
  .chr-wrap-fin {
    max-width: 768px;
    margin: 0 auto;
    padding: 0 40px;
    box-sizing: border-box;
  }
  .chr-nota {
    flex: 1 1 auto;
    min-width: 12rem;
    font-size: 0.86rem;
    color: var(--muted, #7b7770);
  }
  .chr-btn {
    font: inherit;
    font-size: 0.84rem;
    line-height: 1;
    color: var(--ink, #16202b);
    background: #ffffff;
    border: 1px solid var(--line, #e5e2db);
    border-radius: 8px;
    padding: 10px 15px;
    text-decoration: none;
    cursor: pointer;
    white-space: nowrap;
    transition: border-color 0.12s, box-shadow 0.12s;
  }
  .chr-btn:hover {
    border-color: #c9c4ba;
    box-shadow: 0 1px 4px rgba(22, 32, 43, 0.1);
  }
  .chr-btn-suave {
    background: transparent;
    color: var(--muted, #7b7770);
  }
  @media print {
    .chr-barra { display: none !important; }
  }
  @media (max-width: 640px) {
    .chr-wrap-fin { padding: 0 24px; }
    .chr-nota { flex-basis: 100%; }
  }
</style>`;

const botones = `<a class="chr-btn" href="/q/${tokenArg}.html" download="${nombreArchivo}">Descargar</a>
  <button class="chr-btn" type="button" onclick="window.print()">Guardar en PDF</button>`;

const bloqueInicio = `${A}
${estilos}
<div class="chr-barra" role="group" aria-label="Guardar esta propuesta">
  <span class="chr-nota">Podés guardarte esta propuesta para leerla cuando quieras.</span>
  ${botones}
</div>
${A_FIN}`;

/**
 * La barra del final va dentro del contenedor centrado del propio documento,
 * así sus bordes caen exactamente donde caen los del texto. Si el documento no
 * define `.wrap`, se usa el contenedor de respaldo.
 */
function armarBloqueFin(tieneWrap) {
  const clase = tieneWrap ? 'wrap' : 'chr-wrap-fin';
  return `${B}
<div class="${clase}">
  <div class="chr-barra chr-barra-fin" role="group" aria-label="Guardar esta propuesta">
    <span class="chr-nota">Guardá esta propuesta o volvé al principio.</span>
    ${botones}
    <a class="chr-btn chr-btn-suave" href="#top">Ir arriba</a>
  </div>
</div>
${B_FIN}`;
}

const rutaOrigen = resolve(origen);
const rutaDestino = resolve(process.cwd(), 'public', 'q', `${tokenArg}.html`);

let html = await readFile(rutaOrigen, 'utf8');

/** Reemplaza el bloque si ya existe; si no, lo inserta donde diga `insertar`. */
function poner(marcaIni, marcaFin, bloque, insertar) {
  const i = html.indexOf(marcaIni);
  if (i !== -1) {
    const f = html.indexOf(marcaFin) + marcaFin.length;
    html = html.slice(0, i) + bloque + html.slice(f);
    return true;
  }
  return insertar(bloque);
}

// 1) noindex
if (!/name=["']robots["']/i.test(html)) {
  html = html.replace(
    /<head>/i,
    '<head>\n  <meta name="robots" content="noindex, nofollow" />'
  );
}

// 2) ancla para "Ir arriba"
if (!/id=["']top["']/.test(html)) {
  html = html.replace(/<body([^>]*)>/i, '<body$1>\n<span id="top"></span>');
}

// 3) barra de arriba: después del encabezado del documento, antes del primer
//    bloque de contenido. Si el molde cambiara, cae al principio del body.
poner(A, A_FIN, bloqueInicio, (b) => {
  if (/<section/i.test(html)) {
    html = html.replace(/<section/i, `${b}\n<section`);
    return true;
  }
  html = html.replace(/<span id="top"><\/span>/, `<span id="top"></span>\n${b}`);
  return true;
});

// 4) barra del final: después del pie del documento.
const bloqueFin = armarBloqueFin(/\.wrap\s*\{/.test(html));
poner(B, B_FIN, bloqueFin, (b) => {
  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `${b}\n</body>`);
    return true;
  }
  html += `\n${b}\n`;
  return true;
});

await mkdir(dirname(rutaDestino), { recursive: true });
await writeFile(rutaDestino, html, 'utf8');

console.log(`Publicada: public/q/${tokenArg}.html`);
console.log(`Enlace:    https://camposhr.com/q/${tokenArg}`);
console.log(`Descarga:  ${nombreArchivo}`);
console.log('Falta sumar la fila en data/cotizaciones.json y hacer deploy.');
