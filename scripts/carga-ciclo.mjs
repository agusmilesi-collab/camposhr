/**
 * Prueba de carga del ciclo. Simula N teléfonos contra una corrida de prueba.
 *
 * Mide las tres cosas que rompen en la sala: el pico de registro, el sondeo
 * sostenido de todos los teléfonos, y la ráfaga de escrituras cuando la
 * expositora abre una consigna y ochenta personas contestan a la vez.
 *
 * No toca ninguna corrida real: crea la suya con el slug `prueba-carga`, y se
 * borra entera con --limpiar.
 *
 *   node scripts/carga-ciclo.mjs --preparar
 *   node scripts/carga-ciclo.mjs --telefonos 100 --minutos 5 --sondeo 20 --foto selfie.jpg
 *   node scripts/carga-ciclo.mjs --limpiar
 *
 * Por defecto simula la sala de John Deere: su ciclo, los tres datos del
 * registro (área, grado, rol) repartidos como en la sala, y con `--foto` cada
 * teléfono sube esa selfie al registrarse, los cien a la vez. La foto no va al
 * repositorio: se arma aparte, del tamaño que genera el teléfono.
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const arg = (nombre, porDefecto) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? porDefecto : process.argv[i + 1];
};
const bandera = (nombre) => process.argv.includes(`--${nombre}`);

const SITIO = arg('sitio', 'https://camposhr.com');
const SLUG = 'prueba-carga';
// "Conversaciones difíciles", el de John Deere. Con --ciclo se prueba otro.
const CICLO = arg('ciclo', 'be651bc8-0eb2-4330-a59c-5d1f5202e020');
const FOTO = arg('foto', null);
const FOTO_BYTES = FOTO ? readFileSync(FOTO) : null;
const TELEFONOS = Number(arg('telefonos', 100));
const SONDEO = Number(arg('sondeo', 20)) * 1000;
const MINUTOS = Number(arg('minutos', 5));

const PAT = readFileSync(`${process.env.HOME}/.supabase-pat`, 'utf8').trim();

async function sql(query) {
  const r = await fetch(
    'https://api.supabase.com/v1/projects/zfjukftptblojenixivv/database/query',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }
  );
  const t = await r.text();
  if (!r.ok) throw new Error(t);
  return JSON.parse(t);
}

/** Percentil sobre una lista ya ordenada de menor a mayor. */
const pct = (xs, p) =>
  xs.length ? xs[Math.min(xs.length - 1, Math.floor((xs.length * p) / 100))] : 0;

/** Una medición por pedido: cuánto tardó y si falló. */
const medidas = new Map();
function anotar(etiqueta, ms, ok) {
  if (!medidas.has(etiqueta)) medidas.set(etiqueta, { ms: [], n: 0, errores: 0 });
  const m = medidas.get(etiqueta);
  m.ms.push(ms);
  m.n++;
  if (!ok) m.errores++;
}

async function pedir(etiqueta, url, opciones = {}) {
  const t0 = performance.now();
  try {
    const r = await fetch(url, opciones);
    await r.text();
    anotar(etiqueta, performance.now() - t0, r.ok);
    return r.ok;
  } catch {
    anotar(etiqueta, performance.now() - t0, false);
    return false;
  }
}

async function preparar() {
  await sql(`
    insert into empresas (nombre, slug, activa)
    values ('Prueba de carga', '${SLUG}', true)
    on conflict (slug) do nothing;
    insert into corridas (empresa_id, ciclo_id, clave_control, activa)
    select e.id, '${CICLO}', encode(gen_random_bytes(12), 'hex'), true
    from empresas e
    where e.slug = '${SLUG}'
      and not exists (select 1 from corridas c where c.empresa_id = e.id);
  `);
  const [fila] = await sql(
    `select co.id, co.clave_control from corridas co
     join empresas e on e.id = co.empresa_id where e.slug = '${SLUG}'`
  );
  console.log(`corrida de prueba: ${fila.id}\nclave de control: ${fila.clave_control}`);
}

async function limpiar() {
  await sql(`
    delete from aportes where asistente_id in (
      select a.id from asistentes a
      join corridas co on co.id = a.corrida_id
      join empresas e on e.id = co.empresa_id where e.slug = '${SLUG}');
    delete from asistentes where corrida_id in (
      select co.id from corridas co
      join empresas e on e.id = co.empresa_id where e.slug = '${SLUG}');
    delete from corridas where empresa_id in (select id from empresas where slug = '${SLUG}');
    delete from empresas where slug = '${SLUG}';
  `);

  // Las selfies quedan en el bucket aunque se borren los asistentes: se
  // listan por la carpeta de la empresa de prueba y se borran de a cien.
  const base = env.SUPABASE_URL;
  const llave = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  const cabeceras = { Authorization: `Bearer ${llave}`, apikey: llave, 'Content-Type': 'application/json' };
  let borradas = 0;
  for (;;) {
    const r = await fetch(`${base}/storage/v1/object/list/selfies`, {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify({ prefix: `${SLUG}/ciclo`, limit: 100 }),
    });
    const lista = r.ok ? await r.json() : [];
    if (!lista.length) break;
    const prefixes = lista.map((o) => `${SLUG}/ciclo/${o.name}`);
    await fetch(`${base}/storage/v1/object/selfies`, {
      method: 'DELETE',
      headers: cabeceras,
      body: JSON.stringify({ prefixes }),
    });
    borradas += prefixes.length;
  }
  console.log(`corrida de prueba borrada, y ${borradas} selfies`);
}

/** El pico de entrada: todos los teléfonos registrándose al mismo tiempo. */
async function registrar() {
  const t0 = performance.now();
  const ids = await Promise.all(
    Array.from({ length: TELEFONOS }, async (_, i) => {
      const form = new FormData();
      form.append('nombre', `Prueba${i}`);
      form.append('apellido', `Carga${i}`);
      // Como la sala: seis áreas, y uno de cada cinco con menos de un año.
      form.append(
        'datos',
        JSON.stringify({
          area: ['Fábrica', 'Branch', 'JDF', 'Finanzas', 'IT', 'Share'][i % 6],
          grado: ['8', '9', '10 o más'][i % 3],
          rol: i % 5 === 0 ? 'Menos de un año' : 'Más de un año',
        })
      );
      if (FOTO_BYTES) {
        form.append('foto', new Blob([FOTO_BYTES], { type: 'image/jpeg' }), basename(FOTO));
      }
      const t = performance.now();
      try {
        const r = await fetch(`${SITIO}/api/ciclo/${SLUG}/registro`, {
          method: 'POST',
          body: form,
        });
        const j = r.ok ? await r.json() : null;
        anotar(FOTO_BYTES ? 'registro con selfie' : 'registro', performance.now() - t, r.ok);
        return j?.asistente?.id ?? null;
      } catch {
        anotar(FOTO_BYTES ? 'registro con selfie' : 'registro', performance.now() - t, false);
        return null;
      }
    })
  );
  const seg = (performance.now() - t0) / 1000;
  const vivos = ids.filter(Boolean);
  // La ruta registra igual aunque falle la subida de la foto, así que el éxito
  // del pedido no dice si la selfie quedó: se cuenta en la base.
  let fotosPerdidas = 0;
  if (FOTO_BYTES) {
    const [f] = await sql(
      `select count(*)::int as n from asistentes a join corridas co on co.id = a.corrida_id
       join empresas e on e.id = co.empresa_id
       where e.slug = '${SLUG}' and a.foto_path is null`
    );
    fotosPerdidas = f.n;
  }
  console.log(
    `registro: ${vivos.length}/${TELEFONOS} en ${seg.toFixed(1)}s ` +
      `(${(TELEFONOS / seg).toFixed(1)} por segundo)` +
      (FOTO_BYTES
        ? `, con selfie de ${Math.round(FOTO_BYTES.length / 1024)} KB; ${fotosPerdidas} sin foto guardada`
        : '')
  );
  return vivos;
}

/** El sondeo sostenido de toda la sala, con una ráfaga de escrituras al medio. */
async function sondear(ids) {
  // Una consigna abierta desde el arranque: sin nada abierto el sondeo corta
  // antes de leer la base y la prueba mediría el caso barato.
  const [act] = await sql(
    `select id from actividades where ciclo_id = '${CICLO}' and tipo = 'texto'
       and grupo is null order by orden limit 1`
  );
  await sql(`
    update corridas set actividad_abierta_id = '${act.id}'
    where empresa_id = (select id from empresas where slug = '${SLUG}')
  `);
  const hasta = Date.now() + MINUTOS * 60 * 1000;

  const unTelefono = async (id, i) => {
    // Arranque escalonado, igual que en la sala: cada teléfono consulta en su
    // propio momento del intervalo y no todos juntos.
    await new Promise((r) => setTimeout(r, (SONDEO * i) / ids.length));
    let primero = true;
    while (Date.now() < hasta) {
      const q =
        `${SITIO}/api/ciclo/${SLUG}/estado?asistente=${id}` +
        (primero ? '&entrando=1' : '');
      primero = false;
      await pedir('estado', q);
      await new Promise((r) => setTimeout(r, SONDEO));
    }
  };

  const escrituras = async () => {
    await new Promise((r) => setTimeout(r, (MINUTOS * 60 * 1000) / 2));
    const t0 = performance.now();
    await Promise.all(
      ids.map((id) =>
        pedir('aporte', `${SITIO}/api/ciclo/${SLUG}/aporte`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asistenteId: id,
            actividadId: act.id,
            valor: { texto: 'llego tarde el martes y el jueves' },
          }),
        })
      )
    );
    const seg = (performance.now() - t0) / 1000;
    console.log(
      `ráfaga de escritura: ${ids.length} en ${seg.toFixed(1)}s ` +
        `(${(ids.length / seg).toFixed(1)} por segundo)`
    );
  };

  await Promise.all([...ids.map(unTelefono), escrituras()]);
}

function informe() {
  console.log('\n| endpoint | pedidos | errores | p50 | p95 | p99 | máx |');
  console.log('| :-- | --: | --: | --: | --: | --: | --: |');
  for (const [etiqueta, m] of medidas) {
    const xs = m.ms.sort((a, b) => a - b);
    const f = (n) => `${Math.round(n)} ms`;
    console.log(
      `| ${etiqueta} | ${m.n} | ${m.errores} | ${f(pct(xs, 50))} | ` +
        `${f(pct(xs, 95))} | ${f(pct(xs, 99))} | ${f(xs[xs.length - 1] ?? 0)} |`
    );
  }
  const estado = medidas.get('estado');
  if (estado) {
    console.log(
      `\nsondeo sostenido: ${(estado.n / (MINUTOS * 60)).toFixed(1)} consultas por segundo ` +
        `con ${TELEFONOS} teléfonos cada ${SONDEO / 1000}s`
    );
  }
}

if (bandera('preparar')) await preparar();
else if (bandera('limpiar')) await limpiar();
else {
  console.log(
    `${TELEFONOS} teléfonos, sondeo ${SONDEO / 1000}s, ${MINUTOS} min, contra ${SITIO}`
  );
  const ids = await registrar();
  if (!ids.length) {
    console.error('no se registró nadie, ¿corriste --preparar?');
    process.exit(1);
  }
  await sondear(ids);
  informe();
}
