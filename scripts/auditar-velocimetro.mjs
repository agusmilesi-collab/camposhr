/**
 * Mide el velocímetro de competencias contra todos los protocolos cargados.
 *
 *   node scripts/auditar-velocimetro.mjs
 *
 * Corre el motor de verdad (`lib/competencias.ts`) sobre cada sumario guardado
 * y saca cuatro cosas que no se pueden ver de a un informe por vez:
 *
 *   · Cómo se reparten los puntajes de cada competencia, y cuántos valores
 *     distintos puede tomar la aguja.
 *   · Qué hace cada indicador: si discrimina o si sale igual en casi todos.
 *   · Si los indicadores de una competencia miden lo mismo, con el alfa de
 *     Cronbach y la correlación de cada indicador contra el resto de los suyos.
 *   · Cuánto se parecen las competencias entre sí, que es lo que dice si seis
 *     agujas están informando seis cosas o menos.
 *
 * Existe porque los criterios del velocímetro se discuten con números o no se
 * discuten: un corte que deja al 96 % de la gente del mismo lado no se nota
 * leyendo informes de a uno.
 *
 * Las conclusiones de la corrida del 17/9/2026 están en
 * `docs/velocimetro-revision.md`. Volver a correrlo cuando haya más casos.
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');

// Este script corre fuera de Next, así que hay que resolverle lo que Next
// resuelve solo: el alias `@/`, las extensiones `.ts`, los JSON y `server-only`,
// que sin la condición `react-server` del empaquetador se niega a cargar.
const hooks = `
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';
const RAIZ = ${JSON.stringify(RAIZ)};
export async function resolve(especificador, contexto, siguiente) {
  if (especificador === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true };
  if (especificador.endsWith('.json')) {
    const r = await siguiente(especificador, { ...contexto, importAttributes: { type: 'json' } });
    return { ...r, importAttributes: { type: 'json' } };
  }
  const probar = (base) => {
    for (const f of [base, base + '.ts', base + '.tsx', base + '/index.ts']) if (existsSync(f)) return f;
    return null;
  };
  if (especificador.startsWith('@/')) {
    const f = probar(path.join(RAIZ, especificador.slice(2)));
    if (f) return siguiente(pathToFileURL(f).href, contexto);
  }
  if (especificador.startsWith('.')) {
    const f = probar(path.resolve(path.dirname(new URL(contexto.parentURL).pathname), especificador));
    if (f) return siguiente(pathToFileURL(f).href, contexto);
  }
  return siguiente(especificador, contexto);
}`;
register('data:text/javascript,' + encodeURIComponent(hooks));

const { calcularCompetencias, protocoloAlcanza } = await import(path.join(RAIZ, 'lib/competencias.ts'));

// ── Los datos ──────────────────────────────────────────────────────────────

function entorno() {
  const texto = readFileSync(path.join(RAIZ, '.env.local'), 'utf8');
  const leer = (clave) => texto.match(new RegExp(`^${clave}=(.*)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '');
  const url = leer('SUPABASE_URL');
  const key = leer('SUPABASE_SERVICE_KEY');
  if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env.local');
  return { url, key };
}

async function traer(cfg, recurso) {
  const res = await fetch(`${cfg.url}/rest/v1/${recurso}`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
  });
  if (!res.ok) throw new Error(`${recurso}: ${res.status} ${await res.text()}`);
  return res.json();
}

const cfg = entorno();
const [sumarios, evaluaciones, pedidos, baterias, ravenes, discursivos] = await Promise.all([
  traer(cfg, 'sumario_exner?select=evaluacion_id,crudo'),
  traer(cfg, 'evaluaciones?select=id,pedido_id'),
  traer(cfg, 'pedidos?select=id,bateria_id'),
  traer(cfg, 'baterias?select=id,tests'),
  traer(cfg, 'raven?select=evaluacion_id,raw,percentil'),
  traer(cfg, 'analisis_discursivo?select=evaluacion_id,nivel,discurso_celda'),
]);

const porId = (filas, clave = 'id') => new Map(filas.map((f) => [f[clave], f]));
const evals = porId(evaluaciones);
const peds = porId(pedidos);
const bats = porId(baterias);
const ravs = porId(ravenes, 'evaluacion_id');
const discs = porId(discursivos, 'evaluacion_id');

const casos = sumarios.map((s) => {
  const ev = evals.get(s.evaluacion_id);
  const tests = bats.get(peds.get(ev?.pedido_id)?.bateria_id)?.tests ?? [];
  const rav = ravs.get(s.evaluacion_id);
  const disc = discs.get(s.evaluacion_id);
  return {
    crudo: s.crudo,
    test: tests.includes('Zulliger') ? 'Zulliger' : 'Rorschach',
    ctx: {
      ravenPercentil: rav?.percentil ?? null,
      ravenRaw: rav?.raw ?? null,
      potencial: disc?.nivel ? { nivel: disc.nivel, celda: disc.discurso_celda ?? null } : null,
    },
  };
});

// ── Las cuentas ────────────────────────────────────────────────────────────

const VALOR = { 3: 100, 2: 50, 1: 0 };
const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const varianza = (v) => { const m = media(v); return media(v.map((x) => (x - m) ** 2)); };

/** Pearson entre dos series, salteando los pares donde falta un dato. */
function corr(a, b) {
  const pares = a.map((x, i) => [x, b[i]]).filter(([x, y]) => typeof x === 'number' && typeof y === 'number');
  if (pares.length < 5) return null;
  const mx = media(pares.map((p) => p[0])), my = media(pares.map((p) => p[1]));
  let num = 0, dx = 0, dy = 0;
  for (const [x, y] of pares) { num += (x - mx) * (y - my); dx += (x - mx) ** 2; dy += (y - my) ** 2; }
  return dx && dy ? { r: +(num / Math.sqrt(dx * dy)).toFixed(2), n: pares.length } : null;
}

let alcanzan = 0, cortos = 0, evitativos = 0;
for (const c of casos) {
  const v = protocoloAlcanza(c.crudo, c.test);
  if (v.alcanza) alcanzan++;
  else if (v.motivo.includes('mínimo')) cortos++;
  else evitativos++;
}
console.log(`Protocolos con sumario: ${casos.length}`);
console.log(`  puntúan: ${alcanzan} · cortos: ${cortos} · evitativos (Lambda > 0,99): ${evitativos}`);

const medidos = casos
  .map((c) => ({ ...c, comps: calcularCompetencias(c.crudo, c.ctx, c.test) }))
  .filter((c) => c.comps.some((k) => k.puntaje !== null));

for (const test of ['Rorschach', 'Zulliger']) {
  const suyos = medidos.filter((c) => c.test === test);
  if (!suyos.length) continue;
  console.log(`\n${'='.repeat(70)}\n${test} · ${suyos.length} protocolos que puntúan\n${'='.repeat(70)}`);

  const nombres = suyos[0].comps.map((k) => k.nombre);

  console.log('\n-- Cómo se reparte cada competencia --');
  for (const nombre of nombres) {
    const v = suyos.map((c) => c.comps.find((k) => k.nombre === nombre).puntaje).filter((x) => x !== null);
    if (!v.length) continue;
    const s = [...v].sort((a, b) => a - b);
    console.log(
      `${nombre.padEnd(24)} n=${String(s.length).padStart(3)} media=${media(s).toFixed(1).padStart(5)} ` +
      `mediana=${String(s[Math.floor(s.length / 2)]).padStart(3)} min=${String(s[0]).padStart(3)} max=${String(s.at(-1)).padStart(3)} ` +
      `valores distintos=${String(new Set(s).size).padStart(2)} | ` +
      `bajo ${s.filter((x) => x < 35).length} · adecuado ${s.filter((x) => x >= 35 && x < 65).length} · ` +
      `alto ${s.filter((x) => x >= 65 && x < 80).length} · sobresaliente ${s.filter((x) => x >= 80).length}`
    );
  }

  console.log('\n-- Qué hace cada indicador --');
  for (const nombre of nombres) {
    const filas = suyos.map((c) => c.comps.find((k) => k.nombre === nombre));
    const inds = filas[0].renglones.map((r) => r.indicador);
    const completos = filas
      .map((f) => f.renglones.map((r) => (r.nivel === null ? null : VALOR[r.nivel])))
      .filter((v) => v.every((x) => x !== null));
    const k = inds.length;
    let alfa = null;
    if (completos.length >= 10 && k > 1) {
      const sumas = completos.map((v) => v.reduce((a, b) => a + b, 0));
      const sumaVar = inds.reduce((a, _, j) => a + varianza(completos.map((v) => v[j])), 0);
      const vt = varianza(sumas);
      if (vt > 0) alfa = (k / (k - 1)) * (1 - sumaVar / vt);
    }
    console.log(`\n  ${nombre}  (k=${k}, casos completos=${completos.length}${alfa === null ? '' : `, alfa=${alfa.toFixed(2)}`})`);
    for (let j = 0; j < k; j++) {
      const cuenta = { alto: 0, medio: 0, bajo: 0, nulo: 0 };
      for (const f of filas) {
        const n = f.renglones[j].nivel;
        cuenta[n === 3 ? 'alto' : n === 2 ? 'medio' : n === 1 ? 'bajo' : 'nulo']++;
      }
      const total = filas.length;
      const mayor = Math.max(cuenta.alto, cuenta.medio, cuenta.bajo, cuenta.nulo);
      const itemResto = completos.length >= 10
        ? corr(completos.map((v) => v[j]), completos.map((v) => v.filter((_, i) => i !== j).reduce((a, b) => a + b, 0)))
        : null;
      console.log(
        `    ${inds[j].padEnd(30)} alto ${String(cuenta.alto).padStart(3)} · medio ${String(cuenta.medio).padStart(3)} · ` +
        `bajo ${String(cuenta.bajo).padStart(3)} · sin dato ${String(cuenta.nulo).padStart(3)} | ` +
        `constante en el ${String(Math.round((mayor / total) * 100)).padStart(3)} % | ` +
        `r contra el resto ${itemResto === null ? '  s/d' : String(itemResto.r).padStart(5)}`
      );
    }
  }

  console.log('\n-- Cuánto se parecen las competencias entre sí --');
  const vect = Object.fromEntries(nombres.map((n) => [n, suyos.map((c) => c.comps.find((k) => k.nombre === n).puntaje)]));
  const corto = nombres.map((n) => n.slice(0, 9));
  console.log(' '.repeat(12) + corto.map((c) => c.padStart(10)).join(''));
  nombres.forEach((a, i) => {
    console.log(corto[i].padEnd(12) + nombres.map((b, j) => (j <= i ? '' : String(corr(vect[a], vect[b])?.r ?? '')).padStart(10)).join(''));
  });
}

// El Raven es el único indicador con norma poblacional: si los índices del
// protocolo que lo acompañan en su competencia midieran lo mismo que él,
// tendrían que moverse con él.
const raven = [], conRaven = [], sinRaven = [];
for (const c of medidos) {
  const k = c.comps.find((x) => x.nombre === 'Capacidad intelectual');
  if (!k || k.puntaje === null || c.ctx.ravenRaw === null) continue;
  const otros = k.renglones.filter((r) => r.indicador !== 'Raven' && r.nivel !== null);
  if (!otros.length) continue;
  raven.push(c.ctx.ravenRaw);
  conRaven.push(k.puntaje);
  sinRaven.push(media(otros.map((r) => VALOR[r.nivel])));
}
console.log(`\n${'='.repeat(70)}\nEl Raven contra lo que lo acompaña\n${'='.repeat(70)}`);
console.log(`  Raven contra Capacidad intelectual entera: ${JSON.stringify(corr(raven, conRaven))}`);
console.log(`  Raven contra los índices del protocolo de esa competencia: ${JSON.stringify(corr(raven, sinRaven))}`);
