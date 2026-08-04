/**
 * Publica una presentación: copia el HTML del deck a public/pres/<token>.html.
 *
 *   node scripts/publicar-presentacion.mjs <html-origen> <token>
 *
 * A diferencia de las cotizaciones, acá NO se le agrega ninguna barra de
 * acciones: el archivo es una presentación a pantalla completa y cualquier
 * cosa que le metamos encima aparecería proyectada. Lo único que se le suma es
 * el noindex, para que el enlace secreto no lo levante ningún buscador.
 *
 * El archivo se copia tal cual, así que sigue siendo autosuficiente: las
 * tipografías y las imágenes ya viajan adentro y se abre sin internet. Eso es
 * lo que permite descargarlo y darlo en una planta con mala conexión.
 *
 * Es idempotente: publicar dos veces el mismo token pisa el archivo anterior.
 *
 * SOLO SE PUBLICA LA VERSIÓN FINAL, la que se va a dar. Cada archivo pesa más
 * de 1 MB y git guarda todas las versiones para siempre, así que publicar cada
 * corrección infla el repositorio con material que nadie va a volver a mirar.
 * Las vueltas intermedias se trabajan fuera del repositorio y acá entra la
 * definitiva. Si un día esto se vuelve recurrente, el paso siguiente es guardar
 * los archivos en Supabase en vez de en el repositorio.
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [origen, tokenArg] = process.argv.slice(2);

if (!origen || !tokenArg) {
  console.error(
    'Uso: node scripts/publicar-presentacion.mjs <html-origen> <token>'
  );
  process.exit(1);
}

if (!/^[A-Za-z0-9_-]{6,128}$/.test(tokenArg)) {
  console.error(
    `Token inválido: "${tokenArg}". Solo letras, números, guion y guion bajo (6 a 128).`
  );
  process.exit(1);
}

const rutaOrigen = resolve(origen);
const rutaDestino = resolve(process.cwd(), 'public', 'pres', `${tokenArg}.html`);

let html = await readFile(rutaOrigen, 'utf8');

// Aviso, no error: una presentación que depende de la red deja de servir en el
// lugar donde más se necesita. Si aparece, hay que revisar que sea a propósito.
// Se mira también data-src, que es como el deck difiere la carga de la matriz
// del equipo: esa placa sale a buscar los datos en vivo y no puede viajar
// adentro del archivo.
if (
  /<(?:link|script|img|iframe)[^>]+(?:data-src|src|href)=["']https?:\/\//i.test(html)
) {
  console.warn(
    'AVISO: el archivo pide recursos por internet. Si la sala no tiene conexión, no va a verse completo.'
  );
}

if (!/name=["']robots["']/i.test(html)) {
  if (/<head>/i.test(html)) {
    html = html.replace(
      /<head>/i,
      '<head>\n  <meta name="robots" content="noindex, nofollow" />'
    );
  } else {
    // El deck no declara <head>: el navegador lo arma solo, así que alcanza
    // con dejar la etiqueta al principio del documento.
    html = html.replace(
      /(<!doctype html>\s*)?/i,
      (m) => `${m}<meta name="robots" content="noindex, nofollow" />\n`
    );
  }
}

await mkdir(dirname(rutaDestino), { recursive: true });
await writeFile(rutaDestino, html, 'utf8');

const { size } = await stat(rutaDestino);

console.log(`Publicada: public/pres/${tokenArg}.html  (${(size / 1024 / 1024).toFixed(2)} MB)`);
console.log(`Enlace:    https://tools.camposhr.com/pres/${tokenArg}`);
console.log('Falta sumar la fila en data/presentaciones.json y hacer deploy.');
