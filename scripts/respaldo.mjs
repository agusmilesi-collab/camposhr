/**
 * Respaldo completo de Supabase: todas las tablas y todos los archivos.
 *
 *     node scripts/respaldo.mjs <carpeta de destino>
 *
 * Existe porque el plan gratis de Supabase no guarda copias diarias. Deja en
 * la carpeta una subcarpeta con la fecha y, adentro:
 *
 *     tablas/<tabla>.json     todas las filas de cada tabla de `public`
 *     esquema.json            las columnas y tipos de cada tabla, como las publica la API
 *     archivos/<bucket>/...   cada archivo del almacenamiento, con su camino
 *     resumen.json            cuántas filas y cuántos archivos entraron
 *
 * Sale por la API con la clave de servicio y no con `pg_dump`: así no necesita
 * la contraseña de la base ni tener Postgres instalado, y corre igual en esta
 * máquina que en una tarea programada. La contra es que guarda los datos y no
 * el DDL: la estructura se rearma con los archivos de `supabase/`.
 *
 * **Lo que deja son datos de personas.** La carpeta de destino nunca puede
 * estar dentro de este repositorio, que es público: el programa se niega.
 *
 * Las credenciales salen de `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`, del
 * entorno o de `.env.local`.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGINA = 1000;

async function credenciales() {
  let { SUPABASE_URL: url, SUPABASE_SERVICE_KEY: key } = process.env;
  if (!url || !key) {
    const texto = await readFile(join(REPO, '.env.local'), 'utf8').catch(() => '');
    const leer = (nombre) =>
      texto.match(new RegExp(`^${nombre}=(.*)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '');
    url ??= leer('SUPABASE_URL');
    key ??= leer('SUPABASE_SERVICE_KEY');
  }
  if (!url || !key) throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY.');
  return { url: url.replace(/\/$/, ''), key };
}

function hoy() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function pedir(url, key, opciones = {}) {
  const res = await fetch(url, {
    ...opciones,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(opciones.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} en ${url}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

/**
 * Las tablas con sus columnas, como las describe la API.
 *
 * Trae también las vistas: se guardan igual, que sobre un respaldo es
 * preferible una copia de más a una tabla de menos.
 */
async function tablas(url, key) {
  const esquema = await (await pedir(`${url}/rest/v1/`, key)).json();
  const lista = Object.entries(esquema.definitions ?? {}).map(([nombre, d]) => {
    const columnas = Object.keys(d.properties ?? {});
    // La clave primaria viene marcada en la descripción de su columna. Hace
    // falta para paginar: sin orden, dos páginas pueden repetir una fila y
    // saltearse otra.
    const claves = columnas.filter((c) => (d.properties[c].description ?? '').includes('<pk/>'));
    return { nombre, orden: claves.length > 0 ? claves : columnas };
  });
  return { esquema, lista };
}

async function filasDe(url, key, tabla) {
  const todas = [];
  const orden = tabla.orden.map((c) => `${encodeURIComponent(c)}.asc`).join(',');
  for (let desde = 0; ; desde += PAGINA) {
    const res = await pedir(
      `${url}/rest/v1/${encodeURIComponent(tabla.nombre)}?select=*&order=${orden}&limit=${PAGINA}&offset=${desde}`,
      key
    );
    const pagina = await res.json();
    todas.push(...pagina);
    if (pagina.length < PAGINA) return todas;
  }
}

/** Todos los archivos de un bucket, bajando por sus carpetas. */
async function archivosDe(url, key, bucket, prefijo = '') {
  const caminos = [];
  for (let desde = 0; ; desde += PAGINA) {
    const res = await pedir(`${url}/storage/v1/object/list/${bucket}`, key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prefix: prefijo,
        limit: PAGINA,
        offset: desde,
        sortBy: { column: 'name', order: 'asc' },
      }),
    });
    const pagina = await res.json();
    for (const item of pagina) {
      const camino = prefijo ? `${prefijo}/${item.name}` : item.name;
      // Una carpeta viene sin id; un archivo, con el suyo.
      if (item.id === null) caminos.push(...(await archivosDe(url, key, bucket, camino)));
      else caminos.push(camino);
    }
    if (pagina.length < PAGINA) return caminos;
  }
}

async function main() {
  const destino = process.argv[2];
  if (!destino) throw new Error('Uso: node scripts/respaldo.mjs <carpeta de destino>');
  const raiz = resolve(destino);
  if (raiz === REPO || raiz.startsWith(REPO + sep)) {
    throw new Error('El destino no puede estar dentro del repositorio: es público.');
  }

  const { url, key } = await credenciales();
  const carpeta = join(raiz, hoy());
  await mkdir(join(carpeta, 'tablas'), { recursive: true });

  const { esquema, lista } = await tablas(url, key);
  await writeFile(join(carpeta, 'esquema.json'), JSON.stringify(esquema));

  const resumen = { fecha: hoy(), tablas: {}, archivos: {} };
  for (const tabla of lista) {
    const filas = await filasDe(url, key, tabla);
    await writeFile(join(carpeta, 'tablas', `${tabla.nombre}.json`), JSON.stringify(filas));
    resumen.tablas[tabla.nombre] = filas.length;
  }

  const buckets = await (await pedir(`${url}/storage/v1/bucket`, key)).json();
  for (const { name: bucket } of buckets) {
    const caminos = await archivosDe(url, key, bucket);
    // De a ocho: de a uno, quinientos archivos tardaban más de dos minutos.
    const cola = [...caminos];
    const bajar = async () => {
      for (let camino = cola.shift(); camino !== undefined; camino = cola.shift()) {
        const res = await pedir(
          `${url}/storage/v1/object/${bucket}/${camino.split('/').map(encodeURIComponent).join('/')}`,
          key
        );
        const salida = join(carpeta, 'archivos', bucket, camino);
        await mkdir(dirname(salida), { recursive: true });
        await writeFile(salida, Buffer.from(await res.arrayBuffer()));
      }
    };
    await Promise.all(Array.from({ length: 8 }, bajar));
    resumen.archivos[bucket] = caminos.length;
  }

  await writeFile(join(carpeta, 'resumen.json'), JSON.stringify(resumen, null, 2));

  const filas = Object.values(resumen.tablas).reduce((n, x) => n + x, 0);
  const archivos = Object.values(resumen.archivos).reduce((n, x) => n + x, 0);
  console.log(`${carpeta}: ${lista.length} tablas, ${filas} filas, ${archivos} archivos.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
