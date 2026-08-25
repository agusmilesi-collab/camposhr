/**
 * Las competencias del informe, con el método que usa la psicóloga.
 *
 * Sale de las dos hojas de cálculo que venía usando, una para Rorschach y otra
 * para Zulliger: cada indicador puntúa 1, 2 o 3 según caiga bajo, medio o alto.
 * El puntaje de la competencia es el promedio ponderado de sus indicadores, de
 * 0 a 100.
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
import { percentilDe, puntajesPorRango, rangoDe } from '@/lib/raven';

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

/**
 * El puntaje de una constelación.
 *
 * En el sumario una constelación no es un número: es la constelación entera,
 * con su valor, su umbral, si dio positiva y los criterios que la arman. Leerla
 * con `num` devuelve null siempre, y el indicador que la usa queda sin puntuar
 * sin que nadie se entere, porque el promedio tolera que falte uno.
 */
function constelacion(s: SumarioCrudo, nombre: string): number | null {
  const c = s.constelaciones?.[nombre];
  if (c === null || typeof c !== 'object') return null;
  const v = (c as { valor?: unknown }).valor;
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

/**
 * Qué índices leyó un indicador del sumario, con el valor que tenían.
 *
 * No está declarado al lado de cada indicador: se mira mientras la cuenta
 * corre, envolviendo el sumario. Una lista escrita a mano al lado de cada uno
 * se desincroniza el día que un corte cambia de índice, y el desglose sigue
 * mostrando el índice viejo con cara de dato bueno.
 *
 * Es para el desglose que mira la evaluadora: cuando el cliente pregunta de
 * dónde sale un puntaje, tiene los números del protocolo ahí mismo y no tiene
 * que ir a buscarlos a la ficha.
 */
function leidoPor(s: SumarioCrudo, nivel: (s: SumarioCrudo) => Nivel): string | undefined {
  const visto = new Map<string, unknown>();

  const espia = new Proxy(s, {
    get(sumario, seccion) {
      const bloque = sumario[seccion as string];
      if (typeof seccion !== 'string' || bloque === null || typeof bloque !== 'object') {
        return bloque;
      }
      return new Proxy(bloque, {
        get(datos, clave) {
          const v = datos[clave as string];
          if (typeof clave === 'string' && !visto.has(clave)) visto.set(clave, v);
          return v;
        },
      });
    },
  });

  try {
    nivel(espia);
  } catch {
    return undefined;
  }

  const partes = [...visto]
    .map(([clave, v]) => {
      // Una constelación llega entera: de todo el objeto se muestra su valor.
      const dato = v !== null && typeof v === 'object' ? (v as { valor?: unknown }).valor : v;
      if (dato === null || dato === undefined || dato === '' || typeof dato === 'object') return null;
      return `${clave} ${typeof dato === 'number' ? Math.round(dato * 100) / 100 : dato}`;
    })
    .filter(Boolean);

  return partes.length > 0 ? partes.join(' · ') : undefined;
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
    // Solo la banda de arriba es medio. Con `l < 0.3 || l <= 1.5` el extremo de
    // abajo caía en medio: un Lambda de 0,1 es alguien que no consigue
    // simplificar, se implica con todo lo que ve, y se informaba como promedio.
    if (l > 0.99 && l <= 1.5) return 2;
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
          // Sin W no hay razón que calcular, ni siquiera con M en cero: antes
          // ese caso salía bajo sin tener el dato con el que se compara.
          if (m === null || w === null) return null;
          return m === 0 ? 1 : escalonar(w / m, 1.5, 2.5, false);
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
          const w = global(s);
          const d = num(s, 'procesamiento', 'D');
          const dd = num(s, 'procesamiento', 'Dd');
          // Los tres tienen que estar: es una proporción sobre el total de
          // localizaciones, y con una parte ausente el porcentaje sale inflado.
          // El motor escribe los ceros, así que faltar es faltar de verdad.
          if (w === null || d === null || dd === null || w + d + dd === 0) return null;
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
        corte: 'nueve o más alto; siete u ocho medio; menos bajo',
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
        nivel: (s) => escalonar(constelacion(s, 'CDI'), 3, 4, false),
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
          const d = num(s, 'procesamiento', 'D');
          // Sin D, W sobre el total daba 1 y la visión global salía alta por no
          // tener con qué compararla.
          if (w === null || d === null || w + d === 0) return null;
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
  /** 0 a 100. Null cuando falta más de un indicador o el protocolo no alcanza. */
  puntaje: number | null;
  /**
   * Por qué no hay puntaje, cuando el motivo es el protocolo y no el indicador.
   *
   * Se muestra en vez del número: "sin datos" a secas invita a pensar que se
   * olvidaron de cargar algo, y acá lo que pasa es que lo cargado no alcanza
   * para afirmar nada.
   */
  motivo?: string;
  /** Cada indicador con su nivel y su peso, para revisar de dónde sale el número. */
  renglones: {
    indicador: string;
    mide: string;
    nivel: Nivel;
    corte: string;
    peso: number;
    /**
     * Los índices del protocolo que miró, con su valor. Para tenerlos a mano
     * cuando hay que explicar de dónde sale el puntaje.
     */
    datos?: string;
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
 * **El rango sale de `lib/raven.ts` y no se decide acá.** Ahí están los cinco
 * rangos del equipo, que cortan por aciertos, y son los que la ficha ya muestra
 * y los que quedan guardados en el resultado. Este archivo llegó a tener sus
 * propios cortes, por percentil, y con eso el mismo informe le daba dos rangos
 * distintos a la misma persona: veintisiete aciertos son Rango III por el corte
 * del equipo y salían Rango II por el del percentil.
 *
 * **La cuenta no es una regla de tres, en ninguno de sus dos pasos.** El rango
 * decide qué tramo de la escala le toca, y adentro del tramo se interpola por
 * percentil y no por aciertos: esa es la corrección que hay que hacer porque
 * las láminas no valen lo mismo, y las últimas son mucho más difíciles que las
 * primeras.
 */

/**
 * Qué tramo de la escala le toca a cada rango del Raven.
 *
 * **El rango normal llega hasta 72 y no hasta 64, así que su mitad de arriba
 * cae en la banda Alto.** Es decisión de Agustín, del 24/8/2026, y el motivo es
 * que el rango normal abarca diez de los treinta y seis aciertos posibles y la
 * mitad de los candidatos: resolver treinta láminas y resolver veintiuna caen
 * las dos ahí, y no son el mismo desempeño. Con el tope en 64, para que la
 * habilidad cognitiva saliera Alto había que sacar treinta y uno, que es uno de
 * cada dieciséis candidatos.
 *
 * Por eso el desglose puede mostrar Rango III al lado de la banda Alto, y no es
 * una contradicción: el rango es lo que dice el test y la banda es dónde cae la
 * persona en la escala del informe.
 *
 * Los tramos se tocan sin huecos ni saltos: el último acierto de un rango da el
 * número justo anterior al primero del siguiente.
 */
const BANDA_POR_RANGO: Record<string, [number, number]> = {
  I: [86, 100],
  II: [73, 85],
  III: [35, 72],
  IV: [18, 34],
  V: [0, 17],
};

/** Los aciertos del Raven, llevados a la escala de 0 a 100 del informe. */
export function puntajeDeRaven(raw: number): number | null {
  const rango = rangoDe(raw);
  if (!rango) return null;

  const banda = BANDA_POR_RANGO[rango.numeral];
  const tramo = puntajesPorRango().get(rango.numeral);
  if (!banda || !tramo) return null;

  const piso = percentilDe(tramo.desde);
  const techo = percentilDe(tramo.hasta);
  const suyo = percentilDe(raw);
  if (piso === null || techo === null || suyo === null) return null;

  const dentro = techo > piso ? (suyo - piso) / (techo - piso) : 0;
  return Math.round(banda[0] + dentro * (banda[1] - banda[0]));
}

/** Cómo se nombra el rango en el que cayó. */
function rangoRaven(raw: number): string | undefined {
  const r = rangoDe(raw);
  return r ? `Rango ${r.numeral} · ${r.nombre.toLowerCase()}` : undefined;
}

function cognitiva(ctx: Contexto): Competencia {
  const p = ctx.ravenPercentil;
  const raw = ctx.ravenRaw ?? null;

  return {
    nombre: 'Habilidad cognitiva',
    referencia: raw === null ? undefined : rangoRaven(raw),
    mide: 'Estilo de aprendizaje: capacidad de lógica abstracta frente a pensamiento concreto y práctico.',
    puntaje: raw === null ? null : puntajeDeRaven(raw),
    renglones: [
      {
        indicador: 'Raven',
        mide: 'Razonamiento abstracto',
        nivel: null,
        corte: 'el rango del test, y adentro del rango el percentil del baremo',
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

/**
 * Cuántas respuestas hacen falta para que el protocolo diga algo.
 *
 * En Rorschach son catorce, que es la regla de Exner: por debajo el protocolo
 * no se interpreta y se vuelve a tomar. En Zulliger son tres láminas y lo
 * esperable son seis a doce respuestas, así que el piso es seis.
 */
const R_MINIMO: Record<string, number> = { Rorschach: 14, Zulliger: 6 };

/**
 * Desde qué Lambda el protocolo deja de poder afirmar lo que no aparece.
 *
 * Lambda es la proporción de respuestas de forma pura. Pasado uno, el estilo es
 * evitativo: la persona simplifica lo que ve y los indicadores de emoción y de
 * vínculo quedan vacíos **porque el protocolo no los muestra**, no porque el
 * rasgo no esté.
 *
 * Sin este corte, la ausencia de indicadores negativos se leía como un buen
 * resultado. Se vio comparando contra los informes escritos a mano: en un
 * protocolo con Lambda 1,4 el motor daba 67 en habilidad interpersonal y 100 en
 * proactividad, mientras la psicóloga escribía que las habilidades
 * interpersonales estaban por debajo de lo esperado. El mismo motor, contra un
 * protocolo de veintiuna respuestas y Lambda normal, coincidió con ella en las
 * cinco competencias.
 */
const LAMBDA_MAXIMO = 1;

/**
 * Si el protocolo alcanza para puntuar competencias, y si no, por qué no.
 *
 * Es lo primero que hay que mirar: un protocolo que no alcanza no da un puntaje
 * malo, da un puntaje que no significa nada, y esos son los que se leen como si
 * significaran algo.
 */
export function protocoloAlcanza(
  s: SumarioCrudo,
  proyectivo: string | null
): { alcanza: true } | { alcanza: false; motivo: string } {
  const test = proyectivo === 'Zulliger' ? 'Zulliger' : 'Rorschach';
  const r = num(s, 'cabecera', 'R');
  const minimo = R_MINIMO[test];
  if (r !== null && r < minimo) {
    return {
      alcanza: false,
      motivo: `el protocolo tiene ${r} respuestas y el mínimo para ${test} es ${minimo}`,
    };
  }
  const lambda = num(s, 'cabecera', 'Lambda');
  if (lambda !== null && lambda > LAMBDA_MAXIMO) {
    return {
      alcanza: false,
      motivo: `Lambda ${String(lambda).replace('.', ',')}: el protocolo es evitativo y lo que no aparece no se puede leer como ausente`,
    };
  }
  return { alcanza: true };
}

export function calcularCompetencias(
  s: SumarioCrudo,
  ctx: Contexto,
  proyectivo: string | null
): Competencia[] {
  const juego = proyectivo === 'Zulliger' ? ZULLIGER : RORSCHACH;
  const base = protocoloAlcanza(s, proyectivo);

  const medidas = juego.map((c) => {
    const renglones = c.indicadores.map((i) => ({
      indicador: i.nombre,
      mide: i.mide,
      nivel: i.nivel(s),
      corte: i.corte,
      peso: i.peso ?? 1,
      datos: leidoPor(s, i.nivel),
    }));

    // Con el protocolo corto o evitativo no se puntúa ninguna: el número
    // saldría de indicadores que están en cero porque el protocolo no los
    // muestra, y eso se lee al revés de lo que pasa.
    if (!base.alcanza) {
      return {
        nombre: c.competencia,
        mide: c.mide,
        puntaje: null,
        motivo: base.motivo,
        renglones,
      };
    }

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
 * Por qué el puntaje no lleva el signo de porcentaje.
 *
 * Un número con `%` se lee como nota de examen, donde sesenta es raspando, y
 * acá sesenta es un desempeño adecuado. Es un puntaje sobre cien, no un
 * porcentaje de aciertos. El informe lo dibuja sobre la escala de las cuatro
 * bandas (`EscalaBandas`, en `Documento.tsx`), para que el número no quede
 * solo.
 */
