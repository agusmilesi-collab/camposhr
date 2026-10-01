/**
 * Dos controles del velocímetro que no necesitan esperar a los 90 días.
 *
 *   node scripts/validar-velocimetro.mjs
 *
 * **1. Contra el juicio de quien firma.** Cada evaluación lleva el nivel de
 * ajuste que puso la psicóloga. Si el velocímetro dice Sobresaliente donde ella
 * escribió que la persona no encaja, uno de los dos está mal, y hasta que haya
 * seguimiento a 90 días ella es el mejor criterio que tenemos.
 *
 * **2. Cuánto del puntaje es ruido.** Se saca una respuesta del protocolo, se
 * recalcula el sumario entero y se vuelven a puntuar las competencias. Lo que
 * cambia de banda por una sola respuesta es lo que el informe no debería estar
 * afirmando. Se prueba sacando cada respuesta por turno, no una al azar, así el
 * número no depende de la suerte de la corrida.
 *
 * Los dos salen de datos que ya están cargados. Ver `docs/velocimetro-revision.md`.
 */

import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');

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

const { calcularCompetencias } = await import(path.join(RAIZ, 'lib/competencias.ts'));
const { calcularSumario, PERFILES } = await import(path.join(RAIZ, 'lib/exner.ts'));
const { bandaDe, DE_FABRICA } = await import(path.join(RAIZ, 'lib/exigencia.ts'));

// ── Los datos ──────────────────────────────────────────────────────────────

function entorno() {
  const texto = readFileSync(path.join(RAIZ, '.env.local'), 'utf8');
  const leer = (c) => texto.match(new RegExp(`^${c}=(.*)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '');
  return { url: leer('SUPABASE_URL'), key: leer('SUPABASE_SERVICE_KEY') };
}

async function traer(cfg, recurso) {
  const res = await fetch(`${cfg.url}/rest/v1/${recurso}`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
  });
  if (!res.ok) throw new Error(`${recurso}: ${res.status} ${await res.text()}`);
  return res.json();
}

const cfg = entorno();
const [sumarios, evaluaciones, pedidos, baterias, ravenes, discursivos, respuestas] = await Promise.all([
  traer(cfg, 'sumario_exner?select=evaluacion_id,crudo'),
  traer(cfg, 'evaluaciones?select=id,pedido_id,recomendacion'),
  traer(cfg, 'pedidos?select=id,bateria_id'),
  traer(cfg, 'baterias?select=id,tests'),
  traer(cfg, 'raven?select=evaluacion_id,raw,percentil'),
  traer(cfg, 'analisis_discursivo?select=evaluacion_id,nivel,discurso_celda'),
  traer(cfg, 'rorschach_respuestas?select=evaluacion_id,lamina,n_respuesta,localizacion,n_localizacion,determinantes,fq,par,contenidos,popular,z,cc_ee,agc,sl&limit=5000'),
]);

const porId = (filas, clave = 'id') => new Map(filas.map((f) => [f[clave], f]));
const evals = porId(evaluaciones);
const peds = porId(pedidos);
const bats = porId(baterias);
const ravs = porId(ravenes, 'evaluacion_id');
const discs = porId(discursivos, 'evaluacion_id');

const porEvaluacion = new Map();
for (const r of respuestas) {
  if (!porEvaluacion.has(r.evaluacion_id)) porEvaluacion.set(r.evaluacion_id, []);
  porEvaluacion.get(r.evaluacion_id).push(r);
}

const casos = sumarios.map((s) => {
  const ev = evals.get(s.evaluacion_id);
  const tests = bats.get(peds.get(ev?.pedido_id)?.bateria_id)?.tests ?? [];
  const rav = ravs.get(s.evaluacion_id);
  const disc = discs.get(s.evaluacion_id);
  return {
    id: s.evaluacion_id,
    crudo: s.crudo,
    test: tests.includes('Zulliger') ? 'Zulliger' : 'Rorschach',
    recomendacion: ev?.recomendacion ?? null,
    respuestas: porEvaluacion.get(s.evaluacion_id) ?? [],
    ctx: {
      ravenPercentil: rav?.percentil ?? null,
      ravenRaw: rav?.raw ?? null,
      potencial: disc?.nivel ? { nivel: disc.nivel, celda: disc.discurso_celda ?? null } : null,
    },
  };
});

const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const puntajesDe = (c) =>
  calcularCompetencias(c.crudo, c.ctx, c.test).filter((k) => k.puntaje !== null);

// ── 1. Contra el juicio de quien firma ─────────────────────────────────────

/**
 * Los dos vocabularios de la recomendación, llevados a tres niveles.
 *
 * El viejo venía de Airtable ("Apto") y el nuevo es el del informe de hoy
 * ("Encaja con el puesto"). Comparar el puntaje contra siete etiquetas con
 * diecisiete casos no dice nada; contra tres, algo empieza a verse.
 */
const NIVEL = {
  'Apto': 'encaja',
  'Encaja con el puesto': 'encaja',
  'Apto con observaciones': 'con reparos',
  'Apto con alertas': 'con reparos',
  'Encaja, con desarrollo': 'con reparos',
  'No apto': 'no encaja',
  'Encaja si cambia el puesto': 'no encaja',
};

console.log('='.repeat(70));
console.log('1. El velocímetro contra el nivel de ajuste que firmó la psicóloga');
console.log('='.repeat(70));

const conJuicio = casos.filter((c) => NIVEL[c.recomendacion]);
const sinJuicio = casos.length - casos.filter((c) => c.recomendacion).length;
console.log(`\nEvaluaciones con sumario: ${casos.length}`);
console.log(`  con recomendación comparable: ${conJuicio.length}`);
console.log(`  sin recomendación cargada: ${sinJuicio}`);

if (conJuicio.length) {
  const grupos = new Map();
  for (const c of conJuicio) {
    const p = puntajesDe(c);
    if (!p.length) continue;
    const nivel = NIVEL[c.recomendacion];
    if (!grupos.has(nivel)) grupos.set(nivel, []);
    grupos.get(nivel).push({ id: c.id, test: c.test, promedio: media(p.map((k) => k.puntaje)), comps: p });
  }
  console.log('\nPromedio de las competencias, por lo que dijo la psicóloga:');
  for (const nivel of ['encaja', 'con reparos', 'no encaja']) {
    const g = grupos.get(nivel) ?? [];
    if (!g.length) { console.log(`  ${nivel.padEnd(12)} sin casos`); continue; }
    const v = g.map((x) => x.promedio);
    console.log(`  ${nivel.padEnd(12)} n=${String(g.length).padStart(2)}  promedio=${media(v).toFixed(1).padStart(5)}  min=${Math.min(...v).toFixed(0).padStart(3)}  max=${Math.max(...v).toFixed(0).padStart(3)}`);
  }

  // Los que se contradicen: el sistema dice bien y ella dijo que no, o al revés.
  console.log('\nCasos donde el sistema y la psicóloga no coinciden:');
  let choques = 0;
  for (const nivel of ['encaja', 'no encaja']) {
    for (const g of grupos.get(nivel) ?? []) {
      const banda = bandaDe(Math.round(g.promedio), DE_FABRICA);
      const choca =
        (nivel === 'no encaja' && (banda === 'Alto' || banda === 'Sobresaliente')) ||
        (nivel === 'encaja' && banda === 'Bajo');
      if (!choca) continue;
      choques++;
      console.log(`  ${g.id.slice(0, 8)} · ${g.test} · la psicóloga: ${nivel} · el sistema: ${Math.round(g.promedio)} ${banda}`);
    }
  }
  if (!choques) console.log('  ninguno');
}

// ── 2. Cuánto del puntaje es ruido ─────────────────────────────────────────

console.log(`\n${'='.repeat(70)}`);
console.log('2. Qué pasa si el protocolo hubiera tenido una respuesta menos');
console.log('='.repeat(70));

const deFila = (r) => ({
  lam: r.lamina ?? '',
  n_rta: r.n_respuesta ?? 0,
  loc: r.localizacion ?? '',
  n_loc: r.n_localizacion ?? null,
  determinantes: r.determinantes ?? [],
  fq: r.fq ?? '',
  par: Boolean(r.par),
  contenidos: r.contenidos ?? [],
  popular: Boolean(r.popular),
  z: r.z ?? null,
  ccee: r.cc_ee ?? [],
  agc: Boolean(r.agc),
  sl: Boolean(r.sl),
});

const cuenta = {
  Rorschach: { protocolos: 0, pruebas: 0, comparaciones: 0, cambios: 0, sinPuntaje: 0, saltos: [] },
  Zulliger: { protocolos: 0, pruebas: 0, comparaciones: 0, cambios: 0, sinPuntaje: 0, saltos: [] },
};
const porCompetencia = new Map();

for (const c of casos) {
  const filas = [...c.respuestas].sort((a, b) => (a.n_respuesta ?? 0) - (b.n_respuesta ?? 0));
  if (filas.length < 8) continue;
  const perfil = PERFILES[c.test];
  const base = new Map(puntajesDe(c).map((k) => [k.nombre, k.puntaje]));
  if (!base.size) continue;
  const t = cuenta[c.test];
  t.protocolos++;

  for (let i = 0; i < filas.length; i++) {
    const menos = filas.filter((_, j) => j !== i).map(deFila);
    let crudo;
    try {
      crudo = calcularSumario(menos, perfil);
    } catch {
      continue;
    }
    t.pruebas++;
    const nuevas = calcularCompetencias(crudo, c.ctx, c.test);
    for (const k of nuevas) {
      if (!base.has(k.nombre)) continue;
      t.comparaciones++;
      const previo = base.get(k.nombre);
      if (k.puntaje === null) { t.sinPuntaje++; continue; }
      t.saltos.push(Math.abs(k.puntaje - previo));
      if (bandaDe(previo, DE_FABRICA) === bandaDe(k.puntaje, DE_FABRICA)) continue;
      t.cambios++;
      porCompetencia.set(k.nombre, (porCompetencia.get(k.nombre) ?? 0) + 1);
    }
  }
}

for (const [test, t] of Object.entries(cuenta)) {
  if (!t.protocolos) continue;
  const saltoMedio = t.saltos.length ? media(t.saltos) : 0;
  const mueve10 = t.saltos.filter((x) => x >= 10).length;
  console.log(`\n${test}: ${t.protocolos} protocolos, ${t.pruebas} respuestas sacadas de a una`);
  console.log(`  la banda informada cambia en ${t.cambios} de ${t.comparaciones} comparaciones (${((t.cambios / t.comparaciones) * 100).toFixed(1)} %)`);
  console.log(`  el puntaje se corre ${saltoMedio.toFixed(1)} puntos en promedio, y 10 o más en el ${((mueve10 / t.saltos.length) * 100).toFixed(0)} % de los casos`);
  console.log(`  la competencia se queda sin puntaje ${t.sinPuntaje} veces (${((t.sinPuntaje / t.comparaciones) * 100).toFixed(1)} %)`);
}
console.log('\nDónde se concentran los cambios de banda:');
for (const [nombre, n] of [...porCompetencia].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${nombre.padEnd(24)} ${String(n).padStart(4)}`);
}
