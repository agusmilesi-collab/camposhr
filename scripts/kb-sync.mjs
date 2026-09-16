/**
 * Sube la base de conocimiento a Supabase, para poder leerla en tools.
 *
 *   node scripts/kb-sync.mjs [ruta al repo campos-kb]
 *
 * Los archivos viven en el repo privado `campos-kb` y este repositorio es
 * público: por eso el contenido no se versiona acá, se copia a la tabla
 * `kb_docs` y la pantalla la lee de ahí. Va en un solo sentido, del repo a la
 * tabla: lo que se borra del repo se borra de la tabla.
 *
 * Las credenciales salen de `.env.local`, que no está versionado.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const REPO = process.argv[2] ?? join(homedir(), 'Documents', 'campos-kb');

const env = Object.fromEntries(
  readFileSync(join(process.cwd(), '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const URL_BASE = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_KEY;
if (!URL_BASE || !KEY) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env.local');

/** Los datos de arriba del archivo. Sin dependencias: son pares de clave y valor. */
function frente(texto) {
  const m = texto.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, cuerpo: texto };
  const meta = {};
  for (const linea of m[1].split('\n')) {
    const i = linea.indexOf(':');
    if (i > 0) meta[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
  }
  return { meta, cuerpo: texto.slice(m[0].length) };
}

function archivos(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    if (n.startsWith('.')) return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : n.endsWith('.md') ? [p] : [];
  });
}

/** De qué clase es un archivo, por dónde vive. */
function clase(ruta) {
  if (ruta.startsWith('temas/')) return 'tema';
  if (ruta.startsWith('ejercicios/')) return 'ejercicio';
  if (ruta.startsWith('armados/')) return 'armado';
  return 'suelto';
}

const docs = archivos(REPO)
  .map((p) => {
    const ruta = p.replace(`${REPO}/`, '').replace(/\.md$/, '');
    const { meta, cuerpo } = frente(readFileSync(p, 'utf8'));
    // El título sale del primer encabezado, y si no lo hay, del nombre del
    // archivo: escribirlo dos veces es una copia que se desincroniza.
    const h1 = cuerpo.match(/^#\s+(.+)$/m);
    return {
      ruta,
      clase: clase(ruta),
      titulo: meta.tema ?? meta.ejercicio ?? meta.armado ?? h1?.[1] ?? ruta.split('/').pop(),
      meta,
      contenido: cuerpo.trim(),
    };
  })
  // El índice se genera en las dos puntas: en el repo y en la pantalla.
  .filter((d) => d.ruta !== 'INDICE');

const cabeceras = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

const subida = await fetch(`${URL_BASE}/rest/v1/kb_docs`, {
  method: 'POST',
  headers: { ...cabeceras, Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(
    docs.map((d) => ({ ...d, actualizado_at: new Date().toISOString() }))
  ),
});
if (!subida.ok) throw new Error(`Supabase respondió ${subida.status}: ${await subida.text()}`);

// Lo que ya no está en el repo se borra: si no, un archivo renombrado queda dos
// veces en la pantalla.
const vivas = docs.map((d) => `"${d.ruta}"`).join(',');
const borrado = await fetch(`${URL_BASE}/rest/v1/kb_docs?ruta=not.in.(${encodeURIComponent(vivas)})`, {
  method: 'DELETE',
  headers: { ...cabeceras, Prefer: 'return=minimal' },
});
if (!borrado.ok) throw new Error(`Supabase respondió ${borrado.status}: ${await borrado.text()}`);

console.log(`${docs.length} documentos subidos desde ${REPO}.`);
for (const d of docs) console.log(`  ${d.clase.padEnd(10)} ${d.ruta}`);
