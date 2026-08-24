import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { calcularCompetencias } from '@/lib/competencias';
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
  'id,estado,recomendacion,ingreso,seguimiento_resultado,' +
  'fecha_ingreso,fecha_entrevista,fecha_entrega,evaluadoras(nombre),' +
  'raven(raw,percentil),personas(nombre),' +
  'benziger(cuadrante_preferente,cuadrantes_parejos),' +
  'pedidos(puesto,familia,seniority,con_benziger,empresas(nombre),baterias(codigo,tests))';

type Fila = {
  id: string;
  estado: string;
  recomendacion: string | null;
  ingreso: boolean | null;
  seguimiento_resultado: string | null;
  fecha_ingreso: string | null;
  fecha_entrevista: string | null;
  fecha_entrega: string | null;
  evaluadoras: { nombre: string } | null;
  raven: { raw: number | null; percentil: number | null } | null;
  personas: { nombre: string } | null;
  benziger: { cuadrante_preferente: string[] | null; cuadrantes_parejos: boolean | null } | null;
  pedidos: {
    puesto: string;
    familia: string | null;
    seniority: string | null;
    con_benziger: boolean | null;
    empresas: { nombre: string } | null;
    baterias: { codigo: string; tests: string[] | null } | null;
  } | null;
};

type SumarioFila = { evaluacion_id: string; crudo: SumarioCrudo | null };
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
  /** Cómo cierra: el reparto de sus conclusiones. */
  conclusiones: Reparto;
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
  const [filas, sumarios, manchas] = await Promise.all([
    select<Fila>('evaluaciones', `select=${CAMPOS}&order=fecha_ingreso.desc`, CACHE_PSICOTECNICOS),
    select<SumarioFila>('sumario_exner', 'select=evaluacion_id,crudo', CACHE_PSICOTECNICOS),
    select<ManchaFila>('rorschach_respuestas', 'select=evaluacion_id,test', CACHE_PSICOTECNICOS),
  ]);

  const entregadas = filas.filter((f) => f.fecha_entrega);

  // ── Por evaluadora ──────────────────────────────────────────────────────
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
        conclusiones: contar(suyas, (f) => f.recomendacion),
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
    ['Apto', 'Encaja con el puesto'].includes(f.recomendacion as string)
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
        de: filas.filter((f) => f.pedidos?.con_benziger).length,
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
        con: filas.filter((f) => f.pedidos?.con_benziger).length,
        sin: filas.filter((f) => f.pedidos && !f.pedidos.con_benziger).length,
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
  const porEvaluacion = new Map(sumarios.map((s) => [s.evaluacion_id, s.crudo]));
  const testDe = new Map<string, string>();
  for (const m of manchas) {
    if (m.test && !testDe.has(m.evaluacion_id)) testDe.set(m.evaluacion_id, m.test);
  }

  const juntadas = new Map<string, number[]>();
  for (const f of filas) {
    const crudo = porEvaluacion.get(f.id);
    if (!crudo) continue;
    // El test es el que tiene cargado el protocolo y, si no, el de la batería.
    const proyectivo =
      testDe.get(f.id) ??
      (f.pedidos?.baterias?.tests ?? []).find((t) => t === 'Rorschach' || t === 'Zulliger') ??
      null;
    for (const c of calcularCompetencias(crudo, { ravenPercentil: f.raven?.percentil ?? null }, proyectivo)) {
      if (c.puntaje === null) continue;
      juntadas.set(c.nombre, [...(juntadas.get(c.nombre) ?? []), c.puntaje]);
    }
  }

  return [...juntadas.entries()]
    .map(([nombre, xs]) => ({ nombre, mediana: mediana(xs), n: xs.length }))
    .sort((a, b) => (b.mediana ?? 0) - (a.mediana ?? 0));
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
