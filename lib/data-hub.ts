import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { diasDesde } from '@/lib/hora';

/**
 * Los números del negocio, sacados de lo que el sistema ya guarda.
 *
 * **Cada medida dice sobre cuántos casos se calcula.** Con quince evaluaciones,
 * una mediana es una anécdota y hay que poder verlo: un número sin su `n` al
 * lado invita a decidir sobre nada.
 *
 * **Y lo que todavía no alcanza no se muestra igual con menos casos.** Se dice
 * cuántos faltan. El acierto de una evaluación se mide cruzando lo que se
 * recomendó contra cómo le fue a la persona a los noventa días, y ese segundo
 * dato recién se empezó a capturar: hoy hay cero. Mostrar un porcentaje de
 * acierto sobre cero casos sería inventar el número más importante del negocio.
 *
 * Todo sale de Supabase. El histórico que queda en Airtable no entra: su fecha
 * de entrega es una fórmula (`WORKDAY(fecha de entrevista, 3)`), no la fecha en
 * que se entregó, así que cualquier tiempo calculado con ella da tres días
 * hábiles por construcción.
 */

const CAMPOS =
  'id,estado,recomendacion,ingreso,seguimiento_al,seguimiento_resultado,' +
  'fecha_ingreso,fecha_entrevista,fecha_entrega,evaluadoras(nombre),' +
  'raven(raw,percentil),personas(nombre),' +
  'pedidos(puesto,familia,seniority,empresas(nombre),baterias(codigo))';

type Fila = {
  id: string;
  estado: string;
  recomendacion: string | null;
  ingreso: boolean | null;
  seguimiento_al: string | null;
  seguimiento_resultado: string | null;
  fecha_ingreso: string | null;
  fecha_entrevista: string | null;
  fecha_entrega: string | null;
  evaluadoras: { nombre: string } | null;
  raven: { raw: number | null; percentil: number | null } | null;
  personas: { nombre: string } | null;
  pedidos: {
    puesto: string;
    familia: string | null;
    seniority: string | null;
    empresas: { nombre: string } | null;
    baterias: { codigo: string } | null;
  } | null;
};

/** Una medida con la cantidad de casos sobre la que se calculó. */
export type Medida = {
  valor: number | null;
  n: number;
};

export type Reparto = { nombre: string; n: number }[];

export type Tiempos = {
  /** Días de la solicitud a la entrega, para lo que ya se entregó. */
  solicitudAEntrega: Medida & { mediana: number | null; peor: number | null };
  /** Días de la entrevista a la entrega: es el trabajo de análisis. */
  entrevistaAEntrega: Medida & { mediana: number | null; peor: number | null };
  /** Días que lleva esperando lo que todavía no se entregó. */
  enCurso: { n: number; masViejo: number | null };
};

export type Pendiente = {
  medida: string;
  hoy: number;
  hacenFalta: number;
  porque: string;
};

export type DataHub = {
  total: number;
  entregadas: number;
  porEtapa: Reparto;
  porEvaluadora: Reparto;
  porFamilia: Reparto;
  porBateria: Reparto;
  porRecomendacion: Reparto;
  entregasPorMes: { mes: string; n: number }[];
  tiempos: Tiempos;
  raven: { n: number; mediana: number | null; ranking: { nombre: string; percentil: number }[] };
  pendientes: Pendiente[];
};

/** La mediana, que aguanta un caso raro mucho mejor que el promedio. */
function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : Math.round(((o[m - 1] + o[m]) / 2) * 10) / 10;
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

/** Días entre dos fechas, o null si falta alguna o el orden no cierra. */
function dias(desde: string | null, hasta: string | null): number | null {
  if (!desde || !hasta) return null;
  const a = new Date(desde).getTime();
  const b = new Date(hasta).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round(((b - a) / 86400000) * 10) / 10;
}

export async function datosDelHub(): Promise<DataHub> {
  const filas = await select<Fila>(
    'evaluaciones',
    `select=${CAMPOS}&order=fecha_ingreso.desc`,
    CACHE_PSICOTECNICOS
  );

  const entregadas = filas.filter((f) => f.fecha_entrega);

  const solicitud = entregadas
    .map((f) => dias(f.fecha_ingreso, f.fecha_entrega))
    .filter((n): n is number => n !== null);
  const analisis = entregadas
    .map((f) => dias(f.fecha_entrevista, f.fecha_entrega))
    .filter((n): n is number => n !== null);

  // Lo que entró y todavía no se entregó, con lo que lleva esperando el más
  // viejo: es la cola real, y el número que dice si hay que reforzar.
  const enCurso = filas.filter((f) => !f.fecha_entrega && f.fecha_ingreso);
  const esperas = enCurso
    .map((f) => diasDesde(f.fecha_ingreso))
    .filter((n): n is number => n !== null);

  const conPercentil = filas
    .filter((f) => typeof f.raven?.percentil === 'number')
    .map((f) => ({
      nombre: f.personas?.nombre ?? 'Sin nombre',
      percentil: f.raven?.percentil as number,
    }))
    .sort((a, b) => b.percentil - a.percentil);

  const meses = new Map<string, number>();
  for (const f of entregadas) {
    const m = (f.fecha_entrega as string).slice(0, 7);
    meses.set(m, (meses.get(m) ?? 0) + 1);
  }

  return {
    total: filas.length,
    entregadas: entregadas.length,
    porEtapa: contar(filas, (f) => f.estado),
    porEvaluadora: contar(filas, (f) => f.evaluadoras?.nombre ?? 'Sin asignar'),
    porFamilia: contar(filas, (f) => f.pedidos?.familia ?? 'Sin definir'),
    porBateria: contar(filas, (f) => f.pedidos?.baterias?.codigo ?? 'Sin definir'),
    porRecomendacion: contar(filas, (f) => f.recomendacion),
    entregasPorMes: [...meses.entries()]
      .map(([mes, n]) => ({ mes, n }))
      .sort((a, b) => a.mes.localeCompare(b.mes)),
    tiempos: {
      solicitudAEntrega: {
        valor: mediana(solicitud),
        mediana: mediana(solicitud),
        peor: solicitud.length ? Math.max(...solicitud) : null,
        n: solicitud.length,
      },
      entrevistaAEntrega: {
        valor: mediana(analisis),
        mediana: mediana(analisis),
        peor: analisis.length ? Math.max(...analisis) : null,
        n: analisis.length,
      },
      enCurso: { n: enCurso.length, masViejo: esperas.length ? Math.max(...esperas) : null },
    },
    raven: {
      n: conPercentil.length,
      mediana: mediana(conPercentil.map((r) => r.percentil)),
      ranking: conPercentil,
    },
    pendientes: pendientesDe(filas),
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
  const conSeguimiento = filas.filter((f) => f.seguimiento_resultado).length;
  const conIngreso = filas.filter((f) => f.ingreso !== null).length;
  const conRecomendacionYResultado = filas.filter(
    (f) => f.recomendacion && f.seguimiento_resultado
  ).length;
  const conFamiliaYRecomendacion = filas.filter(
    (f) => f.pedidos?.familia && f.recomendacion
  ).length;

  return [
    {
      medida: 'Acierto por evaluadora',
      hoy: conRecomendacionYResultado,
      hacenFalta: 20,
      porque:
        'Se mide cruzando lo que se recomendó contra cómo le fue a la persona a los noventa días. Hace falta el seguimiento hecho.',
    },
    {
      medida: 'Cuántos de los recomendados entran',
      hoy: conIngreso,
      hacenFalta: 15,
      porque: 'Se carga en la ficha, al saber si la empresa la tomó.',
    },
    {
      medida: 'Qué indicadores predicen el desempeño, por familia de puesto',
      hoy: conFamiliaYRecomendacion,
      hacenFalta: 100,
      porque:
        'Es lo que haría falta para un modelo. Con cinco indicadores por competencia, cien casos con resultado conocido es el piso para que no sea ruido.',
    },
    {
      medida: 'Seguimientos hechos',
      hoy: conSeguimiento,
      hacenFalta: 10,
      porque: 'Cada uno vence a los noventa días del ingreso y se contesta por teléfono.',
    },
  ];
}
