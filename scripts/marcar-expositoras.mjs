/**
 * Marca a quien dicta como expositora, para el ensayo de la charla 4.
 *
 *   node scripts/marcar-expositoras.mjs pla-sa Lorena Lucila
 *   node scripts/marcar-expositoras.mjs pla-sa            (sólo muestra quién está marcada)
 *   node scripts/marcar-expositoras.mjs pla-sa --sacar Lorena
 *
 * Quien está marcada queda afuera de los contadores de "cuántos de cuántos", y
 * entra al ensayo sólo cuando el taller no da múltiplo de tres: con 34 entran
 * las dos y son 36, con 32 entra una sola, con 33 no entra ninguna.
 *
 * Se busca por nombre o por apellido, sin distinguir mayúsculas ni acentos. Si
 * el nombre coincide con más de una persona no toca nada y las lista: en una
 * sala de treinta y cuatro puede haber dos Lorenas.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Las credenciales salen del mismo `.env.local` que usa el sitio. */
function entorno() {
  const texto = readFileSync(resolve(raiz, '.env.local'), 'utf8');
  const vars = {};
  for (const linea of texto.split('\n')) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return vars;
}

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = entorno();
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env.local');
  process.exit(1);
}

const cabeceras = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function pedir(ruta, opciones = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { ...cabeceras, ...(opciones.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/** Sin acentos y en minúscula, para que "Lorena" encuentre a "Loréna". */
const plano = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const [slug, ...resto] = process.argv.slice(2);
if (!slug) {
  console.error('Uso: node scripts/marcar-expositoras.mjs <slug> [nombre...]');
  console.error('     node scripts/marcar-expositoras.mjs pla-sa Lorena Lucila');
  process.exit(1);
}

const sacar = resto[0] === '--sacar';
const buscados = sacar ? resto.slice(1) : resto;

const [empresa] = await pedir(
  `empresas?select=id,nombre,slug&slug=eq.${encodeURIComponent(slug)}&limit=1`
);
if (!empresa) {
  console.error(`No hay ninguna empresa con el slug "${slug}".`);
  process.exit(1);
}

const [corrida] = await pedir(
  `corridas?select=id&empresa_id=eq.${empresa.id}&activa=is.true&order=created_at.desc&limit=1`
);
if (!corrida) {
  console.error(`${empresa.nombre} no tiene ninguna corrida activa.`);
  process.exit(1);
}

const asistentes = await pedir(
  `asistentes?select=id,nombre,apellido,expositora&corrida_id=eq.${corrida.id}` +
    `&order=apellido.asc,nombre.asc`
);

function estado() {
  const marcadas = asistentes.filter((a) => a.expositora);
  const taller = asistentes.length - marcadas.length;
  const faltan = (3 - (taller % 3)) % 3;
  console.log(`\n${empresa.nombre}: ${asistentes.length} registrados`);
  console.log(`  del taller:  ${taller}`);
  console.log(
    `  expositoras: ${marcadas.length}` +
      (marcadas.length
        ? ` (${marcadas.map((a) => `${a.nombre} ${a.apellido}`).join(', ')})`
        : '')
  );
  console.log(
    `\nEn el ensayo juegan ${Math.min(faltan, marcadas.length)} de ellas` +
      ` y la sala queda en ${taller + Math.min(faltan, marcadas.length)}` +
      (faltan > marcadas.length
        ? `. FALTAN ${faltan - marcadas.length} para el múltiplo de tres.`
        : '.')
  );
}

if (buscados.length === 0) {
  estado();
  process.exit(0);
}

let cambios = 0;
for (const buscado of buscados) {
  const q = plano(buscado);
  const encontradas = asistentes.filter(
    (a) => plano(a.nombre) === q || plano(a.apellido) === q
  );
  if (encontradas.length === 0) {
    console.log(`✗ "${buscado}": no está registrada todavía.`);
    continue;
  }
  if (encontradas.length > 1) {
    console.log(`✗ "${buscado}": hay ${encontradas.length} y no sé cuál es.`);
    for (const a of encontradas) console.log(`    ${a.nombre} ${a.apellido}`);
    continue;
  }
  const [a] = encontradas;
  if (a.expositora === !sacar) {
    console.log(`· ${a.nombre} ${a.apellido}: ya estaba ${sacar ? 'sin marcar' : 'marcada'}.`);
    continue;
  }
  await pedir(`asistentes?id=eq.${a.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ expositora: !sacar }),
  });
  a.expositora = !sacar;
  cambios++;
  console.log(`✓ ${a.nombre} ${a.apellido}: ${sacar ? 'ya no es' : 'marcada como'} expositora.`);
}

estado();
if (cambios > 0) {
  console.log(
    '\nSi el ensayo ya se repartió, esto no lo cambia: los puestos se escriben' +
      ' al abrir la ronda 1 y no se recalculan.'
  );
}
