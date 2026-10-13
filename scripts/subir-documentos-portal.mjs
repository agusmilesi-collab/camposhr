// Sube los documentos del portal (propuestas, casos, informes escritos a mano)
// al bucket privado, en `portal-documentos/<cliente>/...`.
//
//   node scripts/subir-documentos-portal.mjs <carpeta>
//
// La carpeta no está en el repositorio, que es público: son documentos de
// clientes e informes de personas con nombre y apellido. Viven en
// ~/Documents/camposhr-privado/documentos y se sirven solo contra el enlace
// del portal (ver lib/documentos-portal.ts). Subir de nuevo pisa lo anterior.
import fs from 'node:fs';
import path from 'node:path';

const carpeta = process.argv[2];
if (!carpeta || !fs.existsSync(carpeta)) {
  console.error('Falta la carpeta. Uso: node scripts/subir-documentos-portal.mjs <carpeta>');
  process.exit(1);
}
const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')])
);
const base = env.SUPABASE_URL.replace(/\/$/, '');
const key = env.SUPABASE_SERVICE_KEY;

function archivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivos(path.join(dir, e.name)) : e.name.endsWith('.html') ? [path.join(dir, e.name)] : []
  );
}

let subidos = 0;
for (const archivo of archivos(carpeta)) {
  const ruta = path.relative(carpeta, archivo).split(path.sep).join('/');
  const res = await fetch(`${base}/storage/v1/object/psicotecnicos/portal-documentos/${ruta}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'content-type': 'text/html; charset=utf-8',
      'x-upsert': 'true',
    },
    body: fs.readFileSync(archivo),
  });
  if (!res.ok) {
    console.error(`No subió ${ruta}: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  subidos++;
}
console.log(`${subidos} documentos subidos.`);
