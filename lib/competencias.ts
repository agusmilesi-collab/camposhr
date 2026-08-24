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

/**
 * Cuánto vale cada nivel en la escala de salida.
 *
 * Bajo cero, medio cincuenta, alto cien. El puntaje de la competencia es el
 * promedio de sus indicadores, cada uno por su peso.
 *
 * **Antes había dos tablas de conversión copiadas de las hojas de cálculo** y
 * hacían tres cosas raras, las tres medidas: quien tenía todos los indicadores
 * en medio sacaba 70, que se informa como Alto; quien los tenía todos en bajo
 * sacaba 30, así que el piso no era cero; y solo existían once resultados
 * posibles, en saltos de cinco y diez puntos. Con el promedio, todo en medio da
 * cincuenta y todo en bajo da cero.
 */
const VALOR: Record<1 | 2 | 3, number> = { 1: 0, 2: 50, 3: 100 };

export type Contexto = {
  /** Percentil del Raven, de 0 a 100. Null si no rindió. */
  ravenPercentil: number | null;
  /** Aciertos sobre las treinta y seis láminas. Null si no rindió. */
  ravenRaw?: number | null;
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
  /**
   * Cuánto pesa dentro de su competencia. Uno si no dice nada.
   *
   * Dos para el indicador que mide de frente lo que la competencia define, uno
   * para el que aporta de costado. Antes todos pesaban igual, y eso hacía que en
   * Habilidad interpersonal el índice de egocentrismo valiera lo mismo que la
   * calidad del vínculo. **Los pesos son criterio nuestro y están a la espera de
   * que la psicóloga los revise**, igual que los cortes.
   */
  peso?: number;
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
        // El núcleo: organizar la tarea es lo que la competencia define.
        peso: 2,
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
        // Identificar prioridades está en la definición, con esas palabras.
        peso: 2,
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
        // Con qué cuenta la persona para sostener la presión.
        peso: 2,
        corte: 'nueve o más alto; siete a nueve medio; menos bajo',
        nivel: (s) => escalonar(num(s, 'control_estres', 'EA'), 9, 7),
      },
      {
        nombre: 'D / AdjD',
        mide: 'Tolerancia al estrés, inmediata y sostenida',
        // Mide la tolerancia a la presión, que es la competencia entera.
        peso: 2,
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
      { ...GHR_PHR, peso: 2 },
      COP_AG,
      {
        nombre: 'CDI',
        mide: 'Inhabilidad social',
        // Índice compuesto y del propio Exner: mide la competencia completa.
        peso: 2,
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
        // Iniciativa y rol activo: el centro de la competencia.
        peso: 2,
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
        // Es la primera frase de la definición de Liderazgo.
        peso: 2,
        corte: 'W desde el 45% alto; desde el 30% medio; menos bajo',
        nivel: (s) => {
          const w = global(s);
          const d = num(s, 'procesamiento', 'D') ?? 0;
          if (w === null || w + d === 0) return null;
          return escalonar(w / (w + d), 0.45, 0.3);
        },
      },
      {
        nombre: 'EB',
        mide: 'Estilo de decisión',
        /**
         * El indicador que le faltaba a esta competencia.
         *
         * Liderazgo define tres cosas y medía dos: visión global (W : D) y
         * gestión de personas (prestada de Habilidad interpersonal). **Capacidad
         * de decisión no tenía ningún indicador**, y por eso la competencia se
         * apoyaba en los de vínculo hasta compartir la mitad de su puntaje.
         *
         * El EB es, en Exner, cómo decide la persona. Con un estilo definido,
         * introversivo o extratensivo, decide con un criterio parejo. El
         * ambigual no lo tiene: a veces resuelve pensando y a veces con el
         * afecto, tarda más y es menos previsible. El informe ya lo dice con
         * esas palabras en "Cómo decide y cómo piensa"; lo que faltaba era que
         * alimentara la competencia que lleva la decisión en su definición.
         */
        peso: 2,
        corte: 'estilo definido alto; ambigual bajo',
        nivel: (s) => {
          const estilo = s.control_estres?.estilo;
          if (typeof estilo !== 'string' || !estilo) return null;
          if (estilo === 'Ambigual') return 1;
          return estilo === 'Introversivo' || estilo === 'Extratensivo' ? 3 : null;
        },
      },
      M,
      // Gestión de personas, prestado de Habilidad interpersonal: acá va de
      // apoyo y no de núcleo. Con peso doble en las dos, la mitad del puntaje de
      // Liderazgo era el de la otra competencia. COP / AG salió por lo mismo:
      // su casa es Habilidad interpersonal.
      { ...GHR_PHR, peso: 1 },
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
        // Sin lectura ajustada de la realidad no hay tarea bien coordinada.
        peso: 2,
        corte: 'desde 0,80 alto; desde 0,70 medio; menos bajo',
        nivel: (s) => escalonar(num(s, 'calidad_formal', 'XA_pct'), 0.8, 0.7),
      },
      {
        nombre: 'M',
        mide: 'Planificación y organización mental',
        /**
         * Acá pesa doble y en Proactividad ya no está.
         *
         * Las dos competencias compartían M, Fd y R: tres de cinco cada una, la
         * mitad del puntaje, así que daban casi siempre el mismo número. Se
         * repartieron por lo que dice cada definición. Planificar es el núcleo
         * de coordinar tareas, así que M se queda acá. Fd (autonomía para
         * arrancar) y R (orientación al resultado) se fueron a Proactividad.
         */
        peso: 2,
        corte: 'tres o más alto; dos medio; menos bajo',
        nivel: (s) => escalonar(num(s, 'determinantes', 'M'), 3, 2),
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
        // Modular la emoción es lo que la competencia pide.
        peso: 2,
        corte: 'entre 2,5 y 5 alto; hasta 7 medio; fuera bajo',
        nivel: (s) => {
          const c = num(s, 'afectos', 'WSumC');
          if (c === null) return null;
          if (c >= 2.5 && c <= 5) return 3;
          // Igual que en Lambda: el `c < 2.5` mandaba a medio el extremo de
          // abajo, y un SumC de cero es alguien sin ninguna respuesta de color,
          // con el afecto constreñido. Eso es bajo, no promedio.
          if (c > 5 && c <= 7) return 2;
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
      { ...GHR_PHR, peso: 2 },
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
      // Sin M: es el núcleo de Autogestión, y tenerlo en las dos hacía que las
      // dos competencias de tarea se movieran juntas.
      {
        nombre: 'Ma : Mp',
        mide: 'Tendencia activa frente a pasiva',
        // Activo frente a pasivo es la definición de Proactividad.
        peso: 2,
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
  /**
   * De dónde sale el puntaje cuando el instrumento tiene su propio baremo.
   *
   * Hoy solo la habilidad cognitiva: el rango del Raven en el que cayó, que es
   * el que se tradujo a la banda.
   */
  referencia?: string;
  /**
   * Qué dice el número, en palabras.
   *
   * La habilidad cognitiva lo usa para decir contra qué se comparó a la
   * persona, que es lo que un puntaje solo no cuenta.
   */
  detalle?: string;
  /** 0 a 100. Null cuando falta más de un indicador. */
  puntaje: number | null;
  /** Cada indicador con su nivel y su peso, para revisar de dónde sale el número. */
  renglones: {
    indicador: string;
    mide: string;
    nivel: Nivel;
    corte: string;
    peso: number;
    /**
     * Lo que aportó, cuando no es un nivel de bajo a alto.
     *
     * El Raven entra por su baremo y no escalonado, así que su renglón no
     * tiene nivel: sin esto decía "sin dato" al lado de un puntaje calculado
     * con el dato, que es la peor forma de que alguien desconfíe de un número
     * que está bien.
     */
    valor?: string;
  }[];
};

/**
 * La habilidad cognitiva es el Raven, y hay que traerla a la misma escala.
 *
 * No la miden las manchas, así que no está en ninguna de las dos hojas: entra
 * con lo que resolvió del Raven. El informe muestra nueve competencias con un
 * número de 0 a 100 cada una, y si esta trajera el percentil crudo serían ocho
 * números de una clase y uno de otra, con la misma cara.
 *
 * **El puntaje se calcula en dos pasos, y ninguno de los dos es una regla de
 * tres.** Primero el baremo convierte los aciertos en percentil, que es la
 * corrección que hay que hacer porque las láminas no valen lo mismo: acertar
 * veintitrés de treinta y seis no es el 64% que da la división, es el percentil
 * 78, porque entre esas veintitrés hay difíciles; y acertar nueve, que son las
 * fáciles, no es el 25% sino el percentil 7. Después ese percentil se lleva a
 * la escala del informe con `PUNTAJE_RAVEN`.
 *
 * **El segundo paso tampoco es lineal, y por eso el percentil 92 no da 92.**
 * Los cinco rangos del baremo del Raven se apoyan sobre las cuatro bandas de
 * competencia, tramo con tramo: quien cae en Rango III, que es el término medio
 * del test y agarra la mitad de la población (percentiles 25 a 75), sale
 * Adecuado (35 a 64); Rango II sale Alto; Rango I, Sobresaliente. Adentro del
 * tramo se interpola. Un percentil 92 es Rango II, sobre el término medio pero
 * sin llegar al superior, y da 78: Alto.
 *
 * Así el número dice lo mismo que los otros ocho, se compara con ellos, y sigue
 * apoyado en el baremo del test y no en una división de aciertos.
 */

/**
 * Los tramos que traducen percentil del Raven a puntaje del informe.
 *
 * Cada corte del baremo cae sobre un corte de `BANDAS`, que es lo que hace que
 * el rango del test y la banda del informe digan lo mismo. Si se mueve una
 * banda hay que mover su par acá.
 */
const PUNTAJE_RAVEN = [
  { rango: 'Rango V', percentil: [0, 5], puntaje: [0, 18] },
  { rango: 'Rango IV', percentil: [5, 25], puntaje: [18, 35] },
  { rango: 'Rango III', percentil: [25, 75], puntaje: [35, 65] },
  { rango: 'Rango II', percentil: [75, 95], puntaje: [65, 80] },
  { rango: 'Rango I', percentil: [95, 100], puntaje: [80, 100] },
];

/** En qué rango del baremo del Raven cae un percentil. */
function rangoRaven(p: number): string {
  const t = PUNTAJE_RAVEN.find((x) => p < x.percentil[1]) ?? PUNTAJE_RAVEN[PUNTAJE_RAVEN.length - 1];
  return `${t.rango} · ${NOMBRE_RANGO[t.rango]}`;
}

const NOMBRE_RANGO: Record<string, string> = {
  'Rango I': 'superior',
  'Rango II': 'sobre el término medio',
  'Rango III': 'término medio',
  'Rango IV': 'bajo el término medio',
  'Rango V': 'muy por debajo',
};

/** El percentil del baremo, llevado a la escala de 0 a 100 del informe. */
export function puntajeDeRaven(percentil: number): number {
  const p = Math.min(100, Math.max(0, percentil));
  const t = PUNTAJE_RAVEN.find((x) => p < x.percentil[1]) ?? PUNTAJE_RAVEN[PUNTAJE_RAVEN.length - 1];
  const [pa, pb] = t.percentil;
  const [va, vb] = t.puntaje;
  return Math.round(va + ((p - pa) / (pb - pa)) * (vb - va));
}

function cognitiva(ctx: Contexto): Competencia {
  const p = ctx.ravenPercentil;
  const laminas =
    ctx.ravenRaw === null || ctx.ravenRaw === undefined ? '' : `, resolviendo ${ctx.ravenRaw} de las 36 láminas`;

  return {
    nombre: 'Habilidad cognitiva',
    referencia: p === null ? undefined : rangoRaven(p),
    detalle:
      p === null
        ? undefined
        : `Rinde por encima del ${Math.round(p)}% de la población de referencia${laminas}.`,
    mide: 'Estilo de aprendizaje: capacidad de lógica abstracta frente a pensamiento concreto y práctico.',
    puntaje: p === null ? null : puntajeDeRaven(p),
    renglones: [
      {
        indicador: 'Raven',
        mide: 'Razonamiento abstracto',
        nivel: null,
        corte: 'baremo del test, llevado a la escala del informe',
        peso: 1,
        valor:
          p === null
            ? undefined
            : `percentil ${Math.round(p * 10) / 10}` +
              (ctx.ravenRaw === null || ctx.ravenRaw === undefined
                ? ''
                : ` · ${ctx.ravenRaw} de 36 láminas`),
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
      peso: i.peso ?? 1,
    }));

    const puntuados = renglones.filter((r) => r.nivel !== null);
    // Con dos o más indicadores sin dato se dice que falta, en vez de informar
    // un número que se apoya en la mitad del protocolo.
    if (renglones.length - puntuados.length > 1) {
      return {
        nombre: c.competencia,
        mide: c.mide,
        puntaje: null,
        renglones,
      };
    }

    // El que falta queda afuera del promedio: no suma ni divide. Antes contaba
    // como medio, que es inventarle un valor al dato que no está.
    const pesos = puntuados.reduce((n, r) => n + r.peso, 0);
    const puntaje =
      pesos === 0
        ? null
        : Math.round(
            puntuados.reduce((n, r) => n + r.peso * VALOR[r.nivel as 1 | 2 | 3], 0) / pesos
          );

    return {
      nombre: c.competencia,
      mide: c.mide,
      puntaje,
      renglones,
    };
  });

  return [cognitiva(ctx), ...medidas];
}

/**
 * Cómo se nombra cada puntaje en el informe.
 *
 * Las bandas salen del informe que la psicóloga entrega hoy. Los dos cortes de
 * arriba son los suyos y no se tocaron: 80 y 65.
 *
 * **El de abajo bajó de 50 a 35**, que es donde corta la referencia de la
 * industria: en Hogan, el estándar de evaluación laboral, bajo es hasta el 35 y
 * alto desde el 65, con todo el medio como promedio. Con el corte en 50, la
 * mitad exacta de la escala caía en el borde de Adecuado y cualquier ruido la
 * empujaba a Bajo. Ahora quien está en la mitad de todo queda en la mitad de
 * Adecuado, que es lo que se quiere decir de él.
 */
export type Banda = 'Sobresaliente' | 'Alto' | 'Adecuado' | 'Bajo';

/** Dónde arranca cada banda. En orden, de la más alta a la más baja. */
export const BANDAS: { nombre: Banda; desde: number }[] = [
  { nombre: 'Sobresaliente', desde: 80 },
  { nombre: 'Alto', desde: 65 },
  { nombre: 'Adecuado', desde: 35 },
  { nombre: 'Bajo', desde: 0 },
];

export function bandaDe(puntaje: number | null): Banda | null {
  if (puntaje === null) return null;
  return (BANDAS.find((b) => puntaje >= b.desde) as { nombre: Banda }).nombre;
}

/**
 * El pie de la escala, para el informe.
 *
 * Sin el signo de porcentaje a propósito: un número con `%` se lee como nota de
 * examen, donde sesenta es raspando, y acá sesenta es un desempeño adecuado. Es
 * un puntaje sobre cien, no un porcentaje de aciertos, y el gráfico muestra la
 * zona en la que cae para que el número no quede solo.
 */
export const REFERENCIA_BANDAS =
  'Sobresaliente (80 a 100) · Alto (65 a 79) · Adecuado (35 a 64) · Bajo (menos de 35)';
