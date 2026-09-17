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
 *   node scripts/carga-ciclo.mjs --telefonos 100 --minutos 5 --sondeo 20
 *   node scripts/carga-ciclo.mjs --limpiar
 */

import { readFileSync } from 'node:fs';

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
const CICLO = 'f4b5164a-65b9-41e4-a918-63041aaa1e67';
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
  console.log('corrida de prueba borrada');
}

/** El pico de entrada: todos los teléfonos registrándose al mismo tiempo. */
async function registrar() {
  const t0 = performance.now();
  const ids = await Promise.all(
    Array.from({ length: TELEFONOS }, async (_, i) => {
      const form = new FormData();
      form.append('nombre', `Prueba${i}`);
      form.append('apellido', `Carga${i}`);
      const t = performance.now();
      try {
        const r = await fetch(`${SITIO}/api/ciclo/${SLUG}/registro`, {
          method: 'POST',
          body: form,
        });
        const j = r.ok ? await r.json() : null;
        anotar('registro', performance.now() - t, r.ok);
        return j?.asistente?.id ?? null;
      } catch {
        anotar('registro', performance.now() - t, false);
        return null;
      }
    })
  );
  const seg = (performance.now() - t0) / 1000;
  const vivos = ids.filter(Boolean);
  console.log(
    `registro: ${vivos.length}/${TELEFONOS} en ${seg.toFixed(1)}s ` +
      `(${(TELEFONOS / seg).toFixed(1)} por segundo)`
  );
  return vivos;
}

/** El sondeo sostenido de toda la sala, con una ráfaga de escrituras al medio. */
async function sondear(ids) {
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
    // La consigna tiene que estar abierta en la corrida o el endpoint rechaza
    // todo con 409, que es justamente lo que pasa en la sala si ella no abrió.
    const [act] = await sql(
      `select id from actividades where tipo = 'texto' and grupo is null
       order by orden limit 1`
    );
    await sql(`
      update corridas set actividad_abierta_id = '${act.id}'
      where empresa_id = (select id from empresas where slug = '${SLUG}')
    `);
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
