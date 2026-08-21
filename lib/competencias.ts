/**
 * Las competencias del informe, con el método que usa la psicóloga.
 *
 * Sale de las dos hojas de cálculo que venía usando, una para Rorschach y otra
 * para Zulliger: cada indicador puntúa 1, 2 o 3 según caiga bajo, medio o alto;
 * los puntajes se suman; y una tabla convierte el total en porcentaje. La tabla
 * no es lineal (con cinco indicadores, 9 puntos dan 60% y 10 dan 70%), así que
 * se copia tal cual en lugar de calcularse.
 *
 * **Qué indicador alimenta cada competencia es de las hojas y no se toca.** Lo
 * que sí es criterio propio, y está a la espera de que la psicóloga lo revise,
 * es dónde corta cada indicador entre bajo, medio y alto: las hojas dan la
 * escala pero no los cortes. Cada uno declara el suyo al lado.
 *
 * El Zulliger evalúa cuatro competencias y el Rorschach cinco: el liderazgo se
 * mide solo con el Rorschach, que es el de las baterías para perfiles
 * profesionales y de conducción.
 *
 * La habilidad cognitiva no sale de las manchas sino del Raven, que es el
 * instrumento que la mide.
 */

import type { SumarioCrudo } from '@/lib/redacciones';

/** Bajo, medio o alto. Null cuando el dato no está cargado. */
type Nivel = 1 | 2 | 3 | null;

/** Cómo se convierte el total en porcentaje, por cantidad de indicadores. */
const TABLA_5: Record<number, number> = {
  5: 30,
  6: 40,
  7: 45,
  8: 50,
  9: 60,
  10: 70,
  11: 75,
  12: 80,
  13: 85,
  14: 90,
  15: 100,
};

const TABLA_4: Record<number, number> = {
  4: 30,
  5: 40,
  6: 50,
  7: 60,
  8: 70,
  9: 75,
  10: 80,
  11: 90,
  12: 100,
};

export type Contexto = {
  /** Percentil del Raven, de 0 a 100. Null si no rindió. */
  ravenPercentil: number | null;
};

function num(s: SumarioCrudo, seccion: string, clave: string): number | null {
  const v = s[seccion]?.[clave];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** W vive en localización en el motor del OS. */
function global(s: SumarioCrudo): number | null {
  return num(s, 'localizacion', 'global') ?? num(s, 'procesamiento', 'W');
}

/** Tres cortes en orden: si el valor llega al primero es alto, y así. */
function escalonar(v: number | null, alto: number, medio: number, mayorEsMejor = true): Nivel {
  if (v === null) return null;
  if (mayorEsMejor) return v >= alto ? 3 : v >= medio ? 2 : 1;
  return v <= alto ? 3 : v <= medio ? 2 : 1;
}

type Indicador = {
  nombre: string;
  mide: string;
  /** Dónde corta entre bajo, medio y alto. Es lo que hay que revisar. */
  corte: string;
  nivel: (s: SumarioCrudo) => Nivel;
};

// ── Indicadores compartidos por los dos protocolos ─────────────────────────

const FD: Indicador = {
  nombre: 'Fd',
  mide: 'Autonomía frente a necesidad de apoyo',
  corte: 'sin Fd alto; uno medio; dos o más bajo',
  nivel: (s) => escalonar(num(s, 'interpersonal', 'Fd'), 0, 1, false),
};

const GHR_PHR: Indicador = {
  nombre: 'GHR : PHR',
  mide: 'Calidad del vínculo interpersonal',
  corte: 'GHR mayor que PHR alto; iguales medio; PHR mayor bajo',
  nivel: (s) => {
    const g = num(s, 'interpersonal', 'GHR');
    const p = num(s, 'interpersonal', 'PHR');
    if (g === null || p === null) return null;
    return g > p ? 3 : g === p ? 2 : 1;
  },
};

const AISLAMIENTO: Indicador = {
  nombre: 'Índice de aislamiento',
  mide: 'Grado de retraimiento social',
  corte: 'hasta 0,25 alto; hasta 0,33 medio; por encima bajo',
  nivel: (s) => escalonar(num(s, 'interpersonal', 'Aislamiento'), 0.25, 0.33, false),
};

const EGOCENTRISMO: Indicador = {
  nombre: 'Índice de egocentrismo',
  mide: 'Foco en sí mismo frente al registro del entorno',
  corte: 'entre 0,33 y 0,45 alto; hasta 0,55 medio; fuera de esa banda bajo',
  nivel: (s) => {
    const e = num(s, 'autopercepcion', 'Ego');
    if (e === null) return null;
    if (e >= 0.33 && e <= 0.45) return 3;
    if (e > 0.45 && e <= 0.55) return 2;
    return 1;
  },
};

const FC_CF: Indicador = {
  nombre: 'FC : CF + C',
  mide: 'Capacidad de regulación emocional',
  corte: 'más FC que descarga alto; iguales medio; más descarga bajo',
  nivel: (s) => {
    const fc = num(s, 'afectos', 'FC');
    if (fc === null) return null;
    const descarga = (num(s, 'afectos', 'CF') ?? 0) + (num(s, 'afectos', 'C_puro') ?? 0);
    return fc > descarga ? 3 : fc === descarga ? 2 : 1;
  },
};

const M_Y: Indicador = {
  nombre: 'm + Y',
  mide: 'Nivel de tensión interna y ansiedad',
  corte: 'hasta 2 alto; hasta 4 medio; por encima bajo',
  nivel: (s) => {
    const m = num(s, 'determinantes', 'm');
    const y = num(s, 'determinantes', 'SumY') ?? num(s, 'determinantes', 'Y');
    if (m === null && y === null) return null;
    return escalonar((m ?? 0) + (y ?? 0), 2, 4, false);
  },
};

const COP_AG: Indicador = {
  nombre: 'COP / AG',
  mide: 'Tendencia a la cooperación frente a la confrontación',
  corte: 'dos o más COP con poca AG alto; algún COP medio; sin COP bajo',
  nivel: (s) => {
    const cop = num(s, 'interpersonal', 'COP');
    const ag = num(s, 'interpersonal', 'AG');
    if (cop === null) return null;
    if (cop >= 2 && (ag ?? 0) <= 1) return 3;
    if (cop >= 1) return 2;
    return 1;
  },
};

const M: Indicador = {
  nombre: 'M',
  mide: 'Iniciativa intencional y capacidad de elaboración',
  corte: 'cuatro o más alto; dos o tres medio; menos bajo',
  nivel: (s) => escalonar(num(s, 'determinantes', 'M'), 4, 2),
};

const LAMBDA: Indicador = {
  nombre: 'Lambda',
  mide: 'Estilo de afrontamiento y simplificación',
  corte: 'dentro de 0,30 a 0,99 alto; hasta 1,50 medio; fuera bajo',
  nivel: (s) => {
    const l = num(s, 'cabecera', 'Lambda');
    if (l === null) return null;
    if (l >= 0.3 && l <= 0.99) return 3;
    if (l < 0.3 || l <= 1.5) return 2;
    return 1;
  },
};

// ── Rorschach ──────────────────────────────────────────────────────────────

const RORSCHACH: { competencia: string; mide: string; indicadores: Indicador[] }[] = [
  {
    competencia: 'Autogestión',
    mide: 'Coordinación de tareas en función del tiempo. Identificar prioridades. Gestión del cambio.',
    indicadores: [
      {
        nombre: 'M : W',
        mide: 'Organización mental',
        corte: 'W hasta una vez y media M alto; hasta dos veces y media medio; por encima bajo',
        nivel: (s) => {
          const m = num(s, 'determinantes', 'M');
          const w = global(s);
          if (m === null || w === null || m === 0) return m === 0 ? 1 : null;
          return escalonar(w / m, 1.5, 2.5, false);
        },
      },
      {
        nombre: 'Zd',
        mide: 'Esfuerzo organizativo',
        corte: 'entre −3 y +3 alto; hasta ±5 medio; fuera bajo',
        nivel: (s) => {
          const z = num(s, 'procesamiento', 'Zd');
          return z === null ? null : escalonar(Math.abs(z), 3, 5, false);
        },
      },
      {
        nombre: 'D vs Dd',
        mide: 'Priorización',
        corte: 'Dd hasta el 10% alto; hasta el 15% medio; por encima bajo',
        nivel: (s) => {
          const w = global(s) ?? 0;
          const d = num(s, 'procesamiento', 'D') ?? 0;
          const dd = num(s, 'procesamiento', 'Dd');
          if (dd === null || w + d + dd === 0) return null;
          return escalonar(dd / (w + d + dd), 0.1, 0.15, false);
        },
      },
      {
        nombre: 'FM + m',
        mide: 'Interferencia interna',
        corte: 'hasta 5 alto; hasta 7 medio; por encima bajo',
        nivel: (s) => {
          const fm = num(s, 'determinantes', 'FM');
          const m = num(s, 'determinantes', 'm');
          if (fm === null && m === null) return null;
          return escalonar((fm ?? 0) + (m ?? 0), 5, 7, false);
        },
      },
      FD,
    ],
  },
  {
    competencia: 'Control emocional',
    mide: 'Tolerancia a la presión. Gestión de las emociones en la resolución de conflictos.',
    indicadores: [
      {
        nombre: 'EA',
        mide: 'Recursos disponibles para afrontar demandas',
        corte: 'nueve o más alto; siete a nueve medio; menos bajo',
        nivel: (s) => escalonar(num(s, 'control_estres', 'EA'), 9, 7),
      },
      {
        nombre: 'D / AdjD',
        mide: 'Tolerancia al estrés, inmediata y sostenida',
        corte: 'los dos en cero o más alto; solo AdjD en cero o más medio; AdjD negativo bajo',
        nivel: (s) => {
          const d = num(s, 'control_estres', 'D');
          const adj = num(s, 'control_estres', 'AdjD');
          if (d === null || adj === null) return null;
          if (adj >= 0 && d >= 0) return 3;
          if (adj >= 0) return 2;
          return 1;
        },
      },
      FC_CF,
      M_Y,
      {
        nombre: 'Vagas',
        mide: 'Grado de desorganización frente a la experiencia',
        corte: 'hasta una alto; dos medio; más bajo',
        nivel: (s) =>
          escalonar(num(s, 'procesamiento', 'DQv') ?? num(s, 'localizacion', 'DQv'), 1, 2, false),
      },
    ],
  },
  {
    competencia: 'Habilidad interpersonal',
    mide: 'Negociación. Orientación al cliente externo o interno. Capacidad de comunicación. Empatía.',
    indicadores: [
      GHR_PHR,
      COP_AG,
      {
        nombre: 'CDI',
        mide: 'Inhabilidad social',
        corte: 'hasta 3 alto; 4 medio; 5 bajo',
        nivel: (s) => escalonar(num(s, 'constelaciones', 'CDI'), 3, 4, false),
      },
      AISLAMIENTO,
      EGOCENTRISMO,
    ],
  },
  {
    competencia: 'Proactividad',
    mide: 'Orientación al resultado. Iniciativa. Rol activo en los grupos. Gestión de la innovación.',
    indicadores: [
      FD,
      {
        nombre: 'R',
        mide: 'Nivel general de productividad e iniciativa de respuesta',
        corte: 'veintidós o más alto; diecisiete a veintiuno medio; menos bajo',
        nivel: (s) => escalonar(num(s, 'cabecera', 'R'), 22, 17),
      },
      {
        nombre: 'Ma',
        mide: 'Dinamismo y tendencia a la acción',
        corte: 'dos o más alto; uno medio; ninguno bajo',
        nivel: (s) => escalonar(num(s, 'ideacion', 'Ma'), 2, 1),
      },
      M,
    ],
  },
  {
    competencia: 'Liderazgo',
    mide: 'Visión global frente al foco en el detalle. Gestión de personas. Capacidad de decisión.',
    indicadores: [
      {
        nombre: 'W : D',
        mide: 'Visión global frente al foco en el detalle',
        corte: 'W desde el 45% alto; desde el 30% medio; menos bajo',
        nivel: (s) => {
          const w = global(s);
          const d = num(s, 'procesamiento', 'D') ?? 0;
          if (w === null || w + d === 0) return null;
          return escalonar(w / (w + d), 0.45, 0.3);
        },
      },
      M,
      {
        nombre: 'COP / AG',
        mide: 'Gestión cooperativa y manejo de la imposición',
        corte: 'hasta una AG alto; dos medio; más bajo',
        nivel: (s) => escalonar(num(s, 'interpersonal', 'AG'), 1, 2, false),
      },
      GHR_PHR,
    ],
  },
];

// ── Zulliger ───────────────────────────────────────────────────────────────

const ZULLIGER: { competencia: string; mide: string; indicadores: Indicador[] }[] = [
  {
    competencia: 'Autogestión',
    mide: 'Coordinación de tareas en función del tiempo. Identificar prioridades. Gestión del cambio.',
    indicadores: [
      LAMBDA,
      {
        nombre: 'XA%',
        mide: 'Ajuste perceptual y lectura de la realidad',
        corte: 'desde 0,80 alto; desde 0,70 medio; menos bajo',
        nivel: (s) => escalonar(num(s, 'calidad_formal', 'XA_pct'), 0.8, 0.7),
      },
      {
        nombre: 'M',
        mide: 'Planificación y organización mental',
        corte: 'tres o más alto; dos medio; menos bajo',
        nivel: (s) => escalonar(num(s, 'determinantes', 'M'), 3, 2),
      },
      FD,
      {
        nombre: 'R',
        mide: 'Nivel de productividad e involucramiento',
        corte: 'doce o más alto; ocho a once medio; menos bajo',
        nivel: (s) => escalonar(num(s, 'cabecera', 'R'), 12, 8),
      },
    ],
  },
  {
    competencia: 'Control emocional',
    mide: 'Tolerancia a la presión. Gestión de las emociones en la resolución de conflictos.',
    indicadores: [
      FC_CF,
      M_Y,
      {
        nombre: 'SumC',
        mide: 'Intensidad y modulación emocional',
        corte: 'entre 2,5 y 5 alto; hasta 7 medio; fuera bajo',
        nivel: (s) => {
          const c = num(s, 'afectos', 'WSumC');
          if (c === null) return null;
          if (c >= 2.5 && c <= 5) return 3;
          if (c < 2.5 || c <= 7) return 2;
          return 1;
        },
      },
      { ...LAMBDA, mide: 'Control frente a evitación emocional' },
      {
        nombre: "C'",
        mide: 'Inhibición o restricción emocional',
        corte: 'hasta 2 alto; hasta 4 medio; por encima bajo',
        nivel: (s) => escalonar(num(s, 'afectos', 'SumC_prima'), 2, 4, false),
      },
    ],
  },
  {
    competencia: 'Habilidad interpersonal',
    mide: 'Negociación. Orientación al cliente externo o interno. Capacidad de comunicación. Empatía.',
    indicadores: [
      GHR_PHR,
      COP_AG,
      {
        nombre: 'H',
        mide: 'Interés y apertura hacia los otros',
        corte: 'tres o más alto; dos medio; menos bajo',
        nivel: (s) => escalonar(num(s, 'autopercepcion', 'H_pura'), 3, 2),
      },
      AISLAMIENTO,
      EGOCENTRISMO,
    ],
  },
  {
    competencia: 'Proactividad',
    mide: 'Orientación al resultado. Iniciativa. Rol activo en los grupos. Gestión de la innovación.',
    indicadores: [
      { ...M, mide: 'Iniciativa intencional y dirigida' },
      {
        nombre: 'Ma : Mp',
        mide: 'Tendencia activa frente a pasiva',
        corte: 'más Ma que Mp alto; iguales medio; más Mp bajo',
        nivel: (s) => {
          const ma = num(s, 'ideacion', 'Ma');
          const mp = num(s, 'ideacion', 'Mp');
          if (ma === null || mp === null) return null;
          return ma > mp ? 3 : ma === mp ? 2 : 1;
        },
      },
      {
        nombre: 'FM',
        mide: 'Impulso hacia la acción',
        corte: 'entre 2 y 5 alto; uno medio; ninguno o más de cinco bajo',
        nivel: (s) => {
          const fm = num(s, 'determinantes', 'FM');
          if (fm === null) return null;
          if (fm >= 2 && fm <= 5) return 3;
          if (fm === 1) return 2;
          return 1;
        },
      },
      {
        nombre: 'R',
        mide: 'Nivel de productividad y compromiso con la tarea',
        corte: 'doce o más alto; ocho a once medio; menos bajo',
        nivel: (s) => escalonar(num(s, 'cabecera', 'R'), 12, 8),
      },
      FD,
    ],
  },
];

export type Competencia = {
  nombre: string;
  mide: string;
  /** 0 a 100. Null cuando falta más de un indicador. */
  puntaje: number | null;
  /** Cada indicador con su nivel, para poder revisar de dónde sale el número. */
  renglones: { indicador: string; mide: string; nivel: Nivel; corte: string }[];
};

/**
 * La habilidad cognitiva es el Raven.
 *
 * No la miden las manchas, así que no está en ninguna de las dos hojas: entra
 * con el percentil del instrumento que sí la mide.
 */
function cognitiva(ctx: Contexto): Competencia {
  return {
    nombre: 'Habilidad cognitiva',
    mide: 'Estilo de aprendizaje: capacidad de lógica abstracta frente a pensamiento concreto y práctico.',
    puntaje: ctx.ravenPercentil === null ? null : Math.round(ctx.ravenPercentil),
    renglones: [
      {
        indicador: 'Raven',
        mide: 'Razonamiento abstracto',
        nivel: null,
        corte: 'percentil del baremo',
      },
    ],
  };
}

export function calcularCompetencias(
  s: SumarioCrudo,
  ctx: Contexto,
  proyectivo: string | null
): Competencia[] {
  const juego = proyectivo === 'Zulliger' ? ZULLIGER : RORSCHACH;

  const medidas = juego.map((c) => {
    const renglones = c.indicadores.map((i) => ({
      indicador: i.nombre,
      mide: i.mide,
      nivel: i.nivel(s),
      corte: i.corte,
    }));

    const puntuados = renglones.filter((r) => r.nivel !== null);
    // Con dos o más indicadores sin dato el total no llega a la tabla: se dice
    // que falta en lugar de completar con un promedio.
    const faltan = renglones.length - puntuados.length;
    if (faltan > 1) return { nombre: c.competencia, mide: c.mide, puntaje: null, renglones };

    // El que falta se cuenta como medio, que es lo que no mueve el total hacia
    // ningún lado.
    const total = puntuados.reduce((n, r) => n + (r.nivel as number), 0) + faltan * 2;
    const tabla = renglones.length === 4 ? TABLA_4 : TABLA_5;
    const tope = renglones.length * 3;
    const puntaje = tabla[Math.min(total, tope)] ?? null;

    return { nombre: c.competencia, mide: c.mide, puntaje, renglones };
  });

  return [cognitiva(ctx), ...medidas];
}

/**
 * Cómo se nombra cada puntaje en el informe.
 *
 * Las bandas salen del informe que la psicóloga entrega hoy, donde están
 * impresas al pie del capítulo de competencias.
 */
export type Banda = 'Sobresaliente' | 'Alto' | 'Adecuado' | 'Bajo';

export function bandaDe(puntaje: number | null): Banda | null {
  if (puntaje === null) return null;
  if (puntaje >= 80) return 'Sobresaliente';
  if (puntaje >= 65) return 'Alto';
  if (puntaje >= 50) return 'Adecuado';
  return 'Bajo';
}

/** El pie de la escala, tal como está impreso en el informe. */
export const REFERENCIA_BANDAS =
  'Sobresaliente (80–100%) · Alto (65–79%) · Adecuado (50–64%) · Bajo (menos de 50%)';
