import 'server-only';
import { esEmpresaEjemplo } from '@/lib/portal-ejemplo';
import { select } from '@/lib/supabase';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { calcularCompetencias } from '@/lib/competencias';
import { llevaBenziger } from '@/lib/benziger';
import type { SumarioCrudo } from '@/lib/redacciones';

/**
 * Los números del negocio, sacados de lo que el sistema ya guarda.
 *
 * **Tres ejes, y los tres son de cosas que no cambian mañana**: cómo trabaja
 * cada evaluadora, qué piden los clientes y cómo es la gente que se evalúa. En
 * qué etapa está cada ficha no entra: eso es la foto de hoy, se contesta
 * mirando el pipeline y no deja aprender nada.
 *
 * **Cada medida dice sobre cuántos casos se calcula.** Con quince evaluaciones
 * una mediana es una anécdota, y un número sin su `n` al lado invita a decidir
 * sobre nada.
 *
 * **Lo que todavía no alcanza no se muestra igual con menos casos**: se dice
 * cuántos faltan. El acierto se mide cruzando lo que se recomendó contra cómo
 * le fue a la persona a los noventa días, y ese segundo dato recién se empezó a
 * capturar. Un porcentaje de acierto sobre cero casos sería inventar el número
 * más importante del negocio.
 *
 * Todo sale de Supabase. El histórico que queda en Airtable no entra: su fecha
 * de entrega es una fórmula (`WORKDAY(fecha de entrevista, 3)`), no la fecha en
 * que se entregó, así que cualquier tiempo calculado con ella da tres días
 * hábiles por construcción.
 */

const CAMPOS =
  'id,estado,recomendacion,ingreso,seguimiento_resultado,benziger_administrado,con_benziger,' +
  'fecha_ingreso,fecha_entrevista,fecha_entrega,evaluadoras(nombre),' +
  'raven(raw,percentil),personas(nombre,fecha_nacimiento),' +
  'benziger(cuadrante_preferente,cuadrantes_parejos),' +
  'pedidos(puesto,familia,seniority,con_benziger,puesto_problemas,estrato_puesto,empresas(nombre),baterias(codigo,tests))';

/**
 * A quién le corresponde el Benziger: lo pidió el pedido, se le pidió a esta
 * persona, o se le tomó igual.
 *
 * Contra `pedidos.con_benziger` a secas, el tablero decía "Benziger leído: 4 de
 * 2": el numerador cuenta los leídos de verdad y el denominador contaba los dos
 * pedidos que llevan la marca, cuando hay cuarenta evaluaciones con el Benziger
 * administrado.
 */

type Fila = {
  id: string;
  estado: string;
  recomendacion: string | null;
  ingreso: boolean | null;
  seguimiento_resultado: string | null;
  benziger_administrado: boolean | null;
  con_benziger: boolean | null;
  fecha_ingreso: string | null;
  fecha_entrevista: string | null;
  fecha_entrega: string | null;
  evaluadoras: { nombre: string } | null;
  raven: { raw: number | null; percentil: number | null } | null;
  personas: { nombre: string; fecha_nacimiento: string | null } | null;
  benziger: { cuadrante_preferente: string[] | null; cuadrantes_parejos: boolean | null } | null;
  pedidos: {
    puesto: string;
    familia: string | null;
    seniority: string | null;
    con_benziger: boolean | null;
    puesto_problemas: string | null;
    estrato_puesto: string | null;
    empresas: { nombre: string } | null;
    baterias: { codigo: string; tests: string[] | null } | null;
  } | null;
};

type SumarioFila = { evaluacion_id: string; crudo: SumarioCrudo | null; estilo: string | null };
type ManchaFila = { evaluacion_id: string; test: string | null };

export type Reparto = { nombre: string; n: number }[];

/** Lo que se puede decir de cómo trabaja una evaluadora. */
export type PorEvaluadora = {
  nombre: string;
  entregadas: number;
  enCurso: number;
  /** Días de la entrevista a la entrega: su tiempo de análisis. */
  analisis: { mediana: number | null; n: number };
  /** Días de la solicitud a la entrega: lo que ve el cliente. */
  total: { mediana: number | null; n: number };
  /** Cómo cierra: el reparto de sus conclusiones, de la que menos condiciones pone a la que más. */
  conclusiones: Reparto;
  /** Cuántas entregó cada mes. Los meses son los mismos para todas, así se comparan. */
  porMes: { mes: string; n: number }[];
  /** Cuántas de las suyas tienen el seguimiento hecho. */
  seguimientos: number;
};

export type Competencia = { nombre: string; mediana: number | null; n: number };

/**
 * Qué tan seguido el informe dice algo distinto de "sí".
 *
 * Es el KPI que nadie mide y el que dice si el servicio sirve para decidir. Un
 * informe que siempre cierra en apto no le ahorra un error al cliente: le
 * confirma lo que ya pensaba. No hay un número bueno universal, pero si el
 * ciento por ciento sale apto sin observaciones, el instrumento no está
 * separando a nadie de nadie.
 */
export type Discriminacion = {
  cerrados: number;
  /** Cuántos cierran con alguna reserva: observaciones, alertas o ajuste bajo. */
  conReserva: number;
  /** Cuántos cierran sin ninguna: el "sí" liso. */
  sinReserva: number;
};

/** Cuánto del trabajo depende de un solo cliente. */
export type Concentracion = {
  clientes: number;
  /** Qué parte del total se lleva el más grande, de 0 a 100. */
  delMayor: number | null;
  nombreMayor: string | null;
  /** Clientes que pidieron más de una búsqueda: es la mejor señal de que volvieron. */
  repiten: number;
};

/** Cuántas evaluaciones tienen cada pieza del protocolo cargada. */
export type Completitud = { pieza: string; hechas: number; de: number }[];

export type Pendiente = {
  medida: string;
  hoy: number;
  hacenFalta: number;
  porque: string;
};

/**
 * Una tabla de doble entrada: un grupo por fila y una medida por columna.
 *
 * Cada celda lleva su propio `n`, porque no todas las filas tienen todas las
 * medidas: Liderazgo solo sale del Rorschach, así que en una familia evaluada
 * con Zulliger esa celda se calcula sobre menos gente que las demás.
 */
export type Cruce = {
  columnas: string[];
  filas: { nombre: string; n: number; celdas: { valor: number | null; n: number }[] }[];
  /** Los grupos que no llegan al mínimo de casos y por eso no tienen fila. */
  afuera: Reparto;
};

/** Cómo se reparte un puntaje de 0 a 100 entre los evaluados. */
export type Distribucion = {
  nombre: string;
  n: number;
  mediana: number | null;
  /** Entre estos dos valores cae la mitad central de los evaluados. */
  p25: number | null;
  p75: number | null;
  valores: number[];
};

/**
 * Lo que se puede cruzar hoy de los candidatos.
 *
 * Todo es descriptivo: dice cómo es la gente que se presenta a cada tipo de
 * puesto y cómo cierra su informe. Qué perfil rinde mejor en el puesto no se
 * puede decir, porque no hay ningún seguimiento cargado.
 */
export type Fit = {
  cobertura: { pieza: string; hechas: number; de: number }[];
  distribuciones: Distribucion[];
  competenciaPorFamilia: Cruce;
  competenciaPorNivel: Cruce;
  conclusiones: Reparto;
  conclusionPorFamilia: Cruce;
  conclusionPorNivel: Cruce;
  ravenPorNivel: Distribucion[];
  cuadrantes: Reparto;
  cuadrantePorFamilia: Cruce;
  estilos: Reparto;
  estiloPorFamilia: Cruce;
  /** Los datos que harían falta para medir el ajuste y cuántos hay cargados. */
  faltantes: { pieza: string; hechas: number; de: number; paraQue: string }[];
};

export type DataHub = {
  total: number;
  entregadas: number;
  discriminacion: Discriminacion;
  concentracion: Concentracion;
  completitud: Completitud;
  evaluadoras: PorEvaluadora[];
  pedido: {
    porFamilia: Reparto;
    porNivel: Reparto;
    porBateria: Reparto;
    porEmpresa: Reparto;
    conBenziger: { con: number; sin: number };
    entregasPorMes: { mes: string; n: number }[];
  };
  candidatos: {
    raven: { n: number; mediana: number | null; reparto: Reparto; mejores: { nombre: string; percentil: number }[] };
    conclusiones: Reparto;
    cuadrantes: Reparto;
    competencias: Competencia[];
    fit: Fit;
  };
  pendientes: Pendiente[];
};

/** La mediana, que aguanta un caso raro mucho mejor que el promedio. */
function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  const v = o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
  return Math.round(v * 10) / 10;
}

function contar(filas: Fila[], de: (f: Fila) => string | null | undefined): Reparto {
  const cuenta = new Map<string, number>();
  for (const f of filas) {
    const k = de(f);
    if (!k) continue;
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([nombre, n]) => ({ nombre, n }))
    .sort((a, b) => b.n - a.n);
}

function dias(desde: string | null, hasta: string | null): number | null {
  if (!desde || !hasta) return null;
  const a = new Date(desde).getTime();
  const b = new Date(hasta).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round(((b - a) / 86400000) * 10) / 10;
}

/** En qué tramo del baremo cae un percentil del Raven. */
function rangoRaven(p: number): string {
  if (p >= 95) return 'Rango I · superior';
  if (p >= 75) return 'Rango II · sobre la media';
  if (p >= 25) return 'Rango III · término medio';
  if (p >= 5) return 'Rango IV · bajo la media';
  return 'Rango V · muy bajo';
}

export async function datosDelHub(): Promise<DataHub> {
  let [filas, sumarios, manchas] = await Promise.all([
    select<Fila>('evaluaciones', `select=${CAMPOS}&order=fecha_ingreso.desc`, CACHE_PSICOTECNICOS),
    select<SumarioFila>('sumario_exner', 'select=evaluacion_id,crudo,estilo', CACHE_PSICOTECNICOS),
    select<ManchaFila>('rorschach_respuestas', 'select=evaluacion_id,test', CACHE_PSICOTECNICOS),
  ]);

  // La empresa de la muestra queda afuera de todas las cuentas: sus tres fichas
  // son inventadas y moverían los promedios del negocio.
  filas = filas.filter((f) => !esEmpresaEjemplo(f.pedidos?.empresas?.nombre));

  const entregadas = filas.filter((f) => f.fecha_entrega);

  // ── Por evaluadora ──────────────────────────────────────────────────────
  const mesesConEntregas = [
    ...new Set(entregadas.map((f) => (f.fecha_entrega as string).slice(0, 7))),
  ].sort();
  const nombres = [...new Set(filas.map((f) => f.evaluadoras?.nombre).filter(Boolean))] as string[];
  const evaluadoras: PorEvaluadora[] = nombres
    .map((nombre) => {
      const suyas = filas.filter((f) => f.evaluadoras?.nombre === nombre);
      const cerradas = suyas.filter((f) => f.fecha_entrega);
      const analisis = cerradas
        .map((f) => dias(f.fecha_entrevista, f.fecha_entrega))
        .filter((n): n is number => n !== null);
      const total = cerradas
        .map((f) => dias(f.fecha_ingreso, f.fecha_entrega))
        .filter((n): n is number => n !== null);
      return {
        nombre,
        entregadas: cerradas.length,
        enCurso: suyas.length - cerradas.length,
        analisis: { mediana: mediana(analisis), n: analisis.length },
        total: { mediana: mediana(total), n: total.length },
        conclusiones: enOrden(
          contar(suyas, (f) => f.recomendacion).filter((c) => CONCLUSIONES.includes(c.nombre)),
          CONCLUSIONES
        ),
        porMes: mesesConEntregas.map((mes) => ({
          mes,
          n: cerradas.filter((f) => (f.fecha_entrega as string).startsWith(mes)).length,
        })),
        seguimientos: suyas.filter((f) => f.seguimiento_resultado).length,
      };
    })
    .sort((a, b) => b.entregadas - a.entregadas);

  // ── Lo que se pide ──────────────────────────────────────────────────────
  const meses = new Map<string, number>();
  for (const f of entregadas) {
    const m = (f.fecha_entrega as string).slice(0, 7);
    meses.set(m, (meses.get(m) ?? 0) + 1);
  }

  // ── Los candidatos ──────────────────────────────────────────────────────
  const conPercentil = filas
    .filter((f) => typeof f.raven?.percentil === 'number')
    .map((f) => ({
      nombre: f.personas?.nombre ?? 'Sin nombre',
      percentil: f.raven?.percentil as number,
    }))
    .sort((a, b) => b.percentil - a.percentil);

  const cuadrantes = new Map<string, number>();
  for (const f of filas) {
    for (const q of f.benziger?.cuadrante_preferente ?? []) {
      cuadrantes.set(q, (cuadrantes.get(q) ?? 0) + 1);
    }
  }

  // ── Los tres KPIs de arriba ─────────────────────────────────────────────
  const cerrados = filas.filter((f) => f.recomendacion);
  // Cierra sin reserva el que sale apto liso o encaja con el puesto: todo lo
  // demás le pone una condición al cliente, que es donde el informe sirve.
  const sinReserva = cerrados.filter((f) =>
    ['Ajuste alto', 'Apto', 'Encaja con el puesto'].includes(f.recomendacion as string)
  ).length;

  const porEmpresa = contar(filas, (f) => f.pedidos?.empresas?.nombre);
  const pedidosPorEmpresa = new Map<string, Set<string>>();
  for (const f of filas) {
    const e = f.pedidos?.empresas?.nombre;
    if (!e || !f.pedidos?.puesto) continue;
    if (!pedidosPorEmpresa.has(e)) pedidosPorEmpresa.set(e, new Set());
    pedidosPorEmpresa.get(e)?.add(f.pedidos.puesto);
  }

  const conSumario = new Set(sumarios.map((s) => s.evaluacion_id));

  return {
    total: filas.length,
    entregadas: entregadas.length,
    discriminacion: {
      cerrados: cerrados.length,
      conReserva: cerrados.length - sinReserva,
      sinReserva,
    },
    concentracion: {
      clientes: porEmpresa.length,
      delMayor: porEmpresa.length
        ? Math.round((porEmpresa[0].n / filas.length) * 100)
        : null,
      nombreMayor: porEmpresa[0]?.nombre ?? null,
      repiten: [...pedidosPorEmpresa.values()].filter((p) => p.size > 1).length,
    },
    completitud: [
      { pieza: 'Manchas codificadas', hechas: conSumario.size, de: filas.length },
      {
        pieza: 'Raven puntuado',
        hechas: filas.filter((f) => typeof f.raven?.percentil === 'number').length,
        de: filas.length,
      },
      {
        pieza: 'Benziger leído',
        hechas: filas.filter((f) => (f.benziger?.cuadrante_preferente ?? []).length > 0).length,
        de: filas.filter(llevaBenziger).length,
      },
      {
        pieza: 'Informe cerrado',
        hechas: cerrados.length,
        de: entregadas.length,
      },
    ],
    evaluadoras,
    pedido: {
      porFamilia: contar(filas, (f) => f.pedidos?.familia),
      porNivel: contar(filas, (f) => f.pedidos?.seniority),
      porBateria: contar(filas, (f) => f.pedidos?.baterias?.codigo),
      porEmpresa: contar(filas, (f) => f.pedidos?.empresas?.nombre),
      conBenziger: {
        con: filas.filter(llevaBenziger).length,
        sin: filas.filter((f) => f.pedidos && !llevaBenziger(f)).length,
      },
      entregasPorMes: [...meses.entries()]
        .map(([mes, n]) => ({ mes, n }))
        .sort((a, b) => a.mes.localeCompare(b.mes)),
    },
    candidatos: {
      raven: {
        n: conPercentil.length,
        mediana: mediana(conPercentil.map((r) => r.percentil)),
        reparto: (() => {
          const c = new Map<string, number>();
          for (const r of conPercentil) {
            const k = rangoRaven(r.percentil);
            c.set(k, (c.get(k) ?? 0) + 1);
          }
          return [...c.entries()].map(([nombre, n]) => ({ nombre, n })).sort((a, b) => b.n - a.n);
        })(),
        mejores: conPercentil.slice(0, 8),
      },
      conclusiones: contar(filas, (f) => f.recomendacion),
      cuadrantes: [...cuadrantes.entries()]
        .map(([nombre, n]) => ({ nombre, n }))
        .sort((a, b) => b.n - a.n),
      competencias: medianasDeCompetencias(filas, sumarios, manchas),
      fit: fitDe(filas, sumarios, manchas),
    },
    pendientes: pendientesDe(filas),
  };
}

/**
 * La mediana de cada competencia sobre todos los evaluados.
 *
 * Es la norma propia, y es lo que hoy no existe: el puntaje de una persona se
 * lee contra las bandas, que salen de la literatura, y no contra cómo puntúa la
 * gente que se presenta a estos puestos. Con casos suficientes esto pasa a ser
 * el baremo de la casa, y ahí un 60 deja de discutirse.
 */
function medianasDeCompetencias(
  filas: Fila[],
  sumarios: SumarioFila[],
  manchas: ManchaFila[]
): Competencia[] {
  const juntadas = new Map<string, number[]>();
  for (const puntajes of puntajesPorEvaluacion(filas, sumarios, manchas).values()) {
    for (const [nombre, puntaje] of puntajes) {
      juntadas.set(nombre, [...(juntadas.get(nombre) ?? []), puntaje]);
    }
  }

  return [...juntadas.entries()]
    .map(([nombre, xs]) => ({ nombre, mediana: mediana(xs), n: xs.length }))
    .sort((a, b) => (b.mediana ?? 0) - (a.mediana ?? 0));
}

/** Los puntajes de competencias de cada evaluación que tiene sumario. */
function puntajesPorEvaluacion(
  filas: Fila[],
  sumarios: SumarioFila[],
  manchas: ManchaFila[]
): Map<string, Map<string, number>> {
  const porEvaluacion = new Map(sumarios.map((s) => [s.evaluacion_id, s.crudo]));
  const testDe = new Map<string, string>();
  for (const m of manchas) {
    if (m.test && !testDe.has(m.evaluacion_id)) testDe.set(m.evaluacion_id, m.test);
  }

  const salida = new Map<string, Map<string, number>>();
  for (const f of filas) {
    const crudo = porEvaluacion.get(f.id);
    if (!crudo) continue;
    // El test es el que tiene cargado el protocolo y, si no, el de la batería.
    const proyectivo =
      testDe.get(f.id) ??
      (f.pedidos?.baterias?.tests ?? []).find((t) => t === 'Rorschach' || t === 'Zulliger') ??
      null;
    const suyos = new Map<string, number>();
    for (const c of calcularCompetencias(crudo, { ravenPercentil: f.raven?.percentil ?? null }, proyectivo)) {
      if (c.puntaje !== null) suyos.set(c.nombre, c.puntaje);
    }
    if (suyos.size > 0) salida.set(f.id, suyos);
  }
  return salida;
}

/**
 * Con menos casos que estos, un grupo no tiene fila en los cruces.
 *
 * No sale de ninguna tabla estadística: es el piso debajo del cual la mediana
 * de un grupo es la descripción de dos o tres personas con nombre y apellido.
 */
const MINIMO_POR_GRUPO = 5;

const NIVELES = ['Junior', 'Semi Senior', 'Senior', 'Jefatura', 'Dirección'];
const COMPETENCIAS = [
  'Autogestión',
  'Control emocional',
  'Habilidad interpersonal',
  'Proactividad',
  'Habilidad cognitiva',
  'Liderazgo',
];
/** De la que menos condiciones pone a la que más. */
const CONCLUSIONES = [
  'Ajuste alto',
  'Ajuste con aspectos a desarrollar',
  'Ajuste con alertas',
  'Ajuste bajo',
];
const CUADRANTES = ['FI', 'FD', 'BI', 'BD', 'Más de uno'];
const ESTILOS = ['Introversivo', 'Ambigual', 'Extratensivo'];

function percentil(xs: number[], p: number): number | null {
  if (xs.length === 0) return null;
  const o = [...xs].sort((a, b) => a - b);
  const i = (o.length - 1) * p;
  const abajo = Math.floor(i);
  const v = o[abajo] + (o[Math.min(abajo + 1, o.length - 1)] - o[abajo]) * (i - abajo);
  return Math.round(v);
}

function distribucion(nombre: string, valores: number[]): Distribucion {
  return {
    nombre,
    n: valores.length,
    mediana: mediana(valores),
    p25: percentil(valores, 0.25),
    p75: percentil(valores, 0.75),
    valores: [...valores].sort((a, b) => a - b),
  };
}

/** Los grupos en el orden pedido o, sin orden, del más numeroso al menos. */
function agrupar<T>(casos: T[], grupoDe: (c: T) => string | null | undefined, orden?: string[]) {
  const grupos = new Map<string, T[]>();
  for (const c of casos) {
    const g = grupoDe(c);
    if (!g) continue;
    grupos.set(g, [...(grupos.get(g) ?? []), c]);
  }
  const lista = [...grupos.entries()].sort((a, b) =>
    orden ? orden.indexOf(a[0]) - orden.indexOf(b[0]) : b[1].length - a[1].length
  );
  return {
    adentro: lista.filter(([, cs]) => cs.length >= MINIMO_POR_GRUPO),
    afuera: lista
      .filter(([, cs]) => cs.length < MINIMO_POR_GRUPO)
      .map(([nombre, cs]) => ({ nombre, n: cs.length })),
  };
}

/** La mediana de cada medida dentro de cada grupo. */
function cruceDeMedianas<T>(
  casos: T[],
  grupoDe: (c: T) => string | null | undefined,
  columnas: string[],
  valorDe: (c: T, columna: string) => number | null | undefined,
  orden?: string[]
): Cruce {
  const { adentro, afuera } = agrupar(casos, grupoDe, orden);
  return {
    columnas,
    filas: adentro.map(([nombre, cs]) => ({
      nombre,
      n: cs.length,
      celdas: columnas.map((col) => {
        const xs = cs.map((c) => valorDe(c, col)).filter((v): v is number => typeof v === 'number');
        const m = mediana(xs);
        return { valor: m === null ? null : Math.round(m), n: xs.length };
      }),
    })),
    afuera,
  };
}

/** Cuántos de cada grupo caen en cada categoría. */
function cruceDeCuentas<T>(
  casos: T[],
  grupoDe: (c: T) => string | null | undefined,
  columnas: string[],
  categoriaDe: (c: T) => string | null | undefined,
  orden?: string[]
): Cruce {
  const conCategoria = casos.filter((c) => columnas.includes(categoriaDe(c) ?? ''));
  const { adentro, afuera } = agrupar(conCategoria, grupoDe, orden);
  return {
    columnas,
    filas: adentro.map(([nombre, cs]) => ({
      nombre,
      n: cs.length,
      celdas: columnas.map((col) => ({
        valor: cs.filter((c) => categoriaDe(c) === col).length,
        n: cs.length,
      })),
    })),
    afuera,
  };
}

function enOrden(reparto: Reparto, orden: string[]): Reparto {
  return [...reparto].sort((a, b) => orden.indexOf(a.nombre) - orden.indexOf(b.nombre));
}

function fitDe(filas: Fila[], sumarios: SumarioFila[], manchas: ManchaFila[]): Fit {
  const puntajes = puntajesPorEvaluacion(filas, sumarios, manchas);
  const estiloDe = new Map(sumarios.map((s) => [s.evaluacion_id, s.estilo]));

  const familia = (f: Fila) => f.pedidos?.familia;
  const nivel = (f: Fila) => f.pedidos?.seniority;
  const conclusion = (f: Fila) => f.recomendacion;
  // Quien tiene dos cuadrantes preferentes no es de ninguno de los dos.
  const cuadrante = (f: Fila) => {
    const q = f.benziger?.cuadrante_preferente ?? [];
    return q.length === 0 ? null : q.length === 1 ? q[0] : 'Más de uno';
  };
  const estilo = (f: Fila) => estiloDe.get(f.id);
  const raven = (f: Fila) => f.raven?.percentil;

  const conPuntajes = filas.filter((f) => puntajes.has(f.id));
  const puntajeDe = (f: Fila, competencia: string) => puntajes.get(f.id)?.get(competencia);
  const conRaven = filas.filter((f) => typeof raven(f) === 'number');
  const porNivel = agrupar(conRaven, nivel, NIVELES);

  return {
    cobertura: [
      { pieza: 'Competencias medidas', hechas: conPuntajes.length, de: filas.length },
      { pieza: 'Raven puntuado', hechas: conRaven.length, de: filas.length },
      { pieza: 'Benziger leído', hechas: filas.filter(cuadrante).length, de: filas.length },
      {
        pieza: 'Las tres juntas',
        hechas: filas.filter((f) => puntajes.has(f.id) && typeof raven(f) === 'number' && cuadrante(f))
          .length,
        de: filas.length,
      },
    ],
    distribuciones: COMPETENCIAS.map((c) =>
      distribucion(
        c,
        conPuntajes.map((f) => puntajeDe(f, c)).filter((v): v is number => typeof v === 'number')
      )
    ).filter((d) => d.n > 0),
    competenciaPorFamilia: cruceDeMedianas(conPuntajes, familia, COMPETENCIAS, puntajeDe),
    competenciaPorNivel: cruceDeMedianas(conPuntajes, nivel, COMPETENCIAS, puntajeDe, NIVELES),
    conclusiones: enOrden(
      contar(filas, conclusion).filter((c) => CONCLUSIONES.includes(c.nombre)),
      CONCLUSIONES
    ),
    conclusionPorFamilia: cruceDeCuentas(filas, familia, CONCLUSIONES, conclusion),
    conclusionPorNivel: cruceDeCuentas(filas, nivel, CONCLUSIONES, conclusion, NIVELES),
    ravenPorNivel: porNivel.adentro.map(([nombre, cs]) =>
      distribucion(
        nombre,
        cs.map((f) => raven(f) as number)
      )
    ),
    cuadrantes: enOrden(contar(filas, cuadrante), CUADRANTES),
    cuadrantePorFamilia: cruceDeCuentas(filas, familia, CUADRANTES, cuadrante),
    estilos: enOrden(contar(filas, estilo), ESTILOS),
    estiloPorFamilia: cruceDeCuentas(filas, familia, ESTILOS, estilo),
    faltantes: [
      {
        pieza: 'Contexto del puesto',
        hechas: filas.filter((f) => f.pedidos?.puesto_problemas).length,
        de: filas.length,
        paraQue:
          'Qué problemas resuelve el puesto, con cuánta presión y con qué jefe. Es contra lo que se compara el perfil.',
      },
      {
        pieza: 'Estrato del puesto',
        hechas: filas.filter((f) => f.pedidos?.estrato_puesto).length,
        de: filas.length,
        paraQue: 'Permite comparar el potencial de la persona con la complejidad del puesto.',
      },
      {
        pieza: 'Si la empresa la tomó',
        hechas: filas.filter((f) => f.ingreso !== null).length,
        de: filas.filter((f) => f.fecha_entrega).length,
        paraQue: 'Dice si el cliente decide en la misma dirección que el informe.',
      },
      {
        pieza: 'Seguimiento a los noventa días',
        hechas: filas.filter((f) => f.seguimiento_resultado).length,
        de: filas.filter((f) => f.ingreso === true).length,
        paraQue: 'Es el único dato que dice si el informe acertó.',
      },
      {
        pieza: 'Fecha de nacimiento',
        hechas: filas.filter((f) => f.personas?.fecha_nacimiento).length,
        de: filas.length,
        paraQue: 'El Raven y el potencial se leen distinto según la edad.',
      },
    ],
  };
}

/**
 * Lo que todavía no se puede medir, y cuánto falta para poder.
 *
 * Es la mitad más útil de esta pantalla. Sin esto, el tablero muestra lo que
 * sobra y calla lo que importa: nadie va a cargar el seguimiento si no ve que
 * es lo único que separa al sistema de saber si acierta.
 *
 * Los pisos son deliberadamente bajos y no salen de ninguna tabla estadística:
 * son la cantidad a partir de la cual mirar el número deja de ser una anécdota.
 * Para predecir de verdad hacen falta órdenes de magnitud más.
 */
function pendientesDe(filas: Fila[]): Pendiente[] {
  return [
    {
      medida: 'Acierto por evaluadora',
      hoy: filas.filter((f) => f.recomendacion && f.seguimiento_resultado).length,
      hacenFalta: 20,
      porque:
        'Se mide cruzando lo que se recomendó contra cómo le fue a la persona a los noventa días.',
    },
    {
      medida: 'Cuántos de los recomendados entran',
      hoy: filas.filter((f) => f.ingreso !== null).length,
      hacenFalta: 15,
      porque: 'Se carga en la ficha, al saber si la empresa la tomó.',
    },
    {
      medida: 'Baremo propio de competencias',
      hoy: filas.filter((f) => f.recomendacion).length,
      hacenFalta: 30,
      porque:
        'La mediana de cada competencia sobre los evaluados de la casa, para leer un puntaje contra quienes se presentan a estos puestos y no solo contra la literatura.',
    },
    {
      medida: 'Qué indicadores predicen el desempeño, por familia de puesto',
      hoy: filas.filter((f) => f.pedidos?.familia && f.seguimiento_resultado).length,
      hacenFalta: 100,
      porque:
        'Es lo que haría falta para un modelo. Con cinco indicadores por competencia, cien casos con resultado conocido es el piso para que no sea ruido.',
    },
  ];
}
