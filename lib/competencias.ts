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
 * **Qué indicador va en qué competencia lo definieron las psicólogas el
 * 17/9/2026**, y esa lista es la que está escrita abajo. El Zulliger evalúa
 * cinco competencias y el Rorschach seis: Liderazgo no está en la lista y queda
 * como estaba, a la espera de que digan si sigue.
 *
 * **El Raven es un indicador más de Capacidad intelectual**, junto con los
 * índices del protocolo. Hasta el 17/9/2026 era una competencia aparte,
 * Habilidad cognitiva, que salía solo de él.
 */

import { bandaDeAfr, hEsperado, pEsperado, type SumarioCrudo } from '@/lib/redacciones';
import { percentilDe, puntajesPorRango, rangoDe, type Rango } from '@/lib/raven';
import { ESTRATOS } from '@/lib/potencial';
import {
  comoNumero,
  conDireccion,
  nivelPorEscala,
  numerosDe,
  reglaDeBanda,
  type Escala,
  type Nivel,
} from '@/lib/escalas';

export { numerosDe, comoNumero, reglaDeBanda, conDireccion, type Escala };


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
  /**
   * Los cortes del Raven que rigen, si se movieron desde Sistema.
   *
   * La habilidad cognitiva sale del rango en el que cae el puntaje, así que
   * mover un corte cambia esa competencia: es justamente para lo que está.
   */
  rangos?: Rango[];
  /**
   * El estrato del potencial y su franja, del análisis discursivo.
   *
   * Lo carga la evaluadora escuchando el discurso, así que no está en el
   * sumario: viaja por acá, como el Raven.
   */
  potencial?: { nivel: string | null; celda: string | null } | null;
  /**
   * Lo que pesa cada indicador, si se movió desde Sistema.
   *
   * Solo las diferencias, por `claveDePeso`. Lo que no está acá pesa lo de
   * fábrica.
   */
  pesos?: Record<string, number>;
  /**
   * Dónde corta cada indicador, si se movió desde Sistema.
   *
   * Solo las diferencias, por `claveDePeso`. Cada valor es el arreglo de
   * números de la escala de ese indicador, en el orden de {@link numerosDe}.
   */
  cortesCompetencias?: Record<string, number[]>;
  /**
   * Hacia dónde es mejor cada indicador, si se invirtió desde Sistema.
   *
   * Solo las diferencias, por `claveDePeso`. `true` es que más es mejor.
   */
  direcciones?: Record<string, boolean>;
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
  /**
   * El número que se compara contra la escala.
   *
   * Va junto con `escala`: con los dos, la banda la resuelve el motor y los
   * cortes se pueden mover desde Configuración.
   */
  valor?: (s: SumarioCrudo, ctx: Contexto) => number | null;
  escala?: Escala;
  /**
   * Qué mostrar en el desglose cuando el dato no sale del sumario.
   *
   * Lo usa el Raven, que vive en el contexto: el espía que arma esa línea mira
   * el sumario, y ahí no hay nada que ver.
   */
  datosDe?: (ctx: Contexto) => string | undefined;
  /**
   * Cuándo la banda no sale de un umbral sino de comparar dos índices entre sí.
   *
   * Ahí no hay número que mover, así que el indicador trae su propia función y
   * la regla de cada banda escrita, para que la pantalla la muestre igual.
   */
  nivel?: (s: SumarioCrudo, ctx: Contexto) => Nivel;
  /** Qué dice cada banda, de alto a bajo, cuando no hay escala numérica. */
  reglas?: [string, string, string];
  /**
   * Qué se calcula, en la notación del sumario.
   *
   * No es lo mismo que el nombre del indicador: "D vs Dd" se lee como la parte
   * que Dd se lleva de todas las localizaciones, y sin decirlo cualquiera
   * supondría que se compara D con Dd a secas.
   */
  formula: string;
};

/** La banda de un indicador con los cortes y la dirección que rigen para él. */
function nivelDe(
  i: Indicador,
  s: SumarioCrudo,
  n: number[] | undefined,
  e: Escala | undefined,
  ctx: Contexto
): Nivel {
  const escala = e ?? i.escala;
  if (escala && i.valor) return nivelPorEscala(i.valor(s, ctx), escala, n ?? numerosDe(escala));
  return i.nivel ? i.nivel(s, ctx) : null;
}

// ── Indicadores compartidos por los dos protocolos ─────────────────────────

/**
 * Los indicadores de cada competencia los definieron las psicólogas el
 * 17/9/2026, y esa lista manda: qué índice entra en qué competencia no es
 * criterio nuestro.
 *
 * **Muchos son binarios**: el rasgo está a favor o en contra, sin punto medio
 * ("Lambda entre 0,30 y 0,99 es positivo, fuera es negativo"). Un binario se
 * escribe con las dos bandas de la escala pegadas: la de arriba y la del medio
 * son la misma, así que un valor cae en alto o cae en bajo y nunca en el medio.
 * Los que sí tienen tres bandas están escritos como tales, y ahí el medio es lo
 * adecuado.
 *
 * **Todos pesan uno.** La lista no dice cuánto pesa cada uno, y el promedio
 * ponderado con pesos inventados hacía que dos indicadores decidieran la
 * competencia. Se mueven desde Configuración.
 */
const binario = (corte: number, mayorEsMejor: boolean, decimales?: number, porcentaje?: boolean): Escala => ({
  forma: 'umbral',
  mayorEsMejor,
  alto: corte,
  medio: corte,
  ...(decimales === undefined ? {} : { decimales }),
  ...(porcentaje ? { porcentaje } : {}),
});

/** Dentro del intervalo es positivo y fuera, para cualquier lado, negativo. */
const dentroDe = (desde: number, hasta: number, decimales?: number): Escala => ({
  forma: 'banda',
  alto: [desde, hasta],
  medio: [desde, hasta],
  ...(decimales === undefined ? {} : { decimales }),
});

const FD: Indicador = {
  nombre: 'Fd',
  formula: 'Fd',
  mide: 'Autonomía frente a necesidad de apoyo',
  escala: binario(0, false),
  valor: (s) => num(s, 'interpersonal', 'Fd'),
};

const GHR_PHR: Indicador = {
  nombre: 'GHR : PHR',
  formula: 'GHR contra PHR',
  mide: 'Calidad del vínculo interpersonal',
  reglas: ['GHR mayor que PHR', 'no se usa', 'GHR igual o menor que PHR'],
  nivel: (s) => {
    const g = num(s, 'interpersonal', 'GHR');
    const p = num(s, 'interpersonal', 'PHR');
    if (g === null || p === null) return null;
    return g > p ? 3 : 1;
  },
};

/** El de Liderazgo, que conserva sus tres bandas hasta que lo revisen. */
const GHR_PHR_TRES: Indicador = {
  ...GHR_PHR,
  reglas: ['GHR mayor que PHR', 'GHR igual a PHR', 'PHR mayor que GHR'],
  nivel: (s) => {
    const g = num(s, 'interpersonal', 'GHR');
    const p = num(s, 'interpersonal', 'PHR');
    if (g === null || p === null) return null;
    return g > p ? 3 : g === p ? 2 : 1;
  },
};

const AISLAMIENTO: Indicador = {
  nombre: 'Índice de aislamiento',
  formula: '(Bt + 2Cl + Ge + Ls + 2Na) ÷ R',
  mide: 'Grado de retraimiento social',
  escala: binario(0.33, false, 2),
  valor: (s) => num(s, 'interpersonal', 'Aislamiento'),
};

const EGOCENTRISMO: Indicador = {
  nombre: 'Índice de egocentrismo',
  formula: '(3r + (2)) ÷ R',
  // Alto es negativo; dentro del rango o bajo, positivo. Por eso es binario y
  // no una banda: quedarse corto no descuenta.
  mide: 'Foco en sí mismo frente al registro del entorno',
  escala: binario(0.55, false, 2),
  valor: (s) => num(s, 'autopercepcion', 'Ego'),
};

const FC_CF: Indicador = {
  nombre: 'FC : CF + C',
  formula: 'FC contra CF + C pura',
  mide: 'Capacidad de regulación emocional',
  reglas: ['FC mayor que CF + C', 'no se usa', 'CF + C igual o mayor que FC'],
  nivel: (s) => {
    const fc = num(s, 'afectos', 'FC');
    if (fc === null) return null;
    const descarga = (num(s, 'afectos', 'CF') ?? 0) + (num(s, 'afectos', 'C_puro') ?? 0);
    return fc > descarga ? 3 : 1;
  },
};

const M_Y: Indicador = {
  nombre: 'm + Y',
  formula: 'm + SumY',
  mide: 'Nivel de tensión interna y ansiedad',
  escala: binario(2, false),
  valor: (s) => {
    const m = num(s, 'determinantes', 'm');
    const y = num(s, 'determinantes', 'SumY') ?? num(s, 'determinantes', 'Y');
    if (m === null && y === null) return null;
    return (m ?? 0) + (y ?? 0);
  },
};

const COP_AG: Indicador = {
  nombre: 'COP / AG',
  formula: 'COP y AG',
  mide: 'Tendencia a la cooperación frente a la confrontación',
  reglas: ['dos o más COP y hasta una AG', 'al menos una COP', 'ninguna COP'],
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
  formula: 'M',
  mide: 'Iniciativa intencional y capacidad de elaboración',
  escala: { forma: 'umbral', mayorEsMejor: true, alto: 4, medio: 2 },
  valor: (s) => num(s, 'determinantes', 'M'),
};

/** El estilo del EB: solo el introversivo juega a favor. */
const EB: Indicador = {
  nombre: 'EB',
  formula: 'el estilo del EB',
  mide: 'Estilo de decisión',
  reglas: ['introversivo', 'no se usa', 'ambigual o extratensivo'],
  nivel: (s) => {
    const estilo = s.control_estres?.estilo;
    if (typeof estilo !== 'string' || !estilo) return null;
    if (estilo === 'Introversivo') return 3;
    return estilo === 'Ambigual' || estilo === 'Extratensivo' ? 1 : null;
  },
};

/**
 * W : M, que se espera exactamente en el doble.
 *
 * Con M en cero la razón no existe y la lectura es la peor: la organización
 * mental no aparece.
 */
const W_M: Indicador = {
  nombre: 'W : M',
  formula: 'W ÷ M',
  mide: 'Organización mental',
  reglas: ['W igual al doble de M', 'no se usa', 'W distinto del doble de M'],
  nivel: (s) => {
    const m = num(s, 'determinantes', 'M');
    const w = global(s);
    if (m === null || w === null) return null;
    return m > 0 && w / m === 2 ? 3 : 1;
  },
};

const ZD: Indicador = {
  nombre: 'Zd',
  formula: 'Zd',
  mide: 'Esfuerzo organizativo',
  escala: dentroDe(-3, 3, 1),
  valor: (s) => num(s, 'procesamiento', 'Zd'),
};

const MA_MP: Indicador = {
  nombre: 'Ma : Mp',
  formula: 'Ma contra Mp',
  mide: 'Tendencia activa frente a pasiva',
  reglas: ['Mp hasta Ma + 1', 'no se usa', 'Mp por encima de Ma + 1'],
  nivel: (s) => {
    const ma = num(s, 'ideacion', 'Ma');
    const mp = num(s, 'ideacion', 'Mp');
    if (ma === null || mp === null) return null;
    return mp > ma + 1 ? 1 : 3;
  },
};

const XA_WDA: Indicador = {
  nombre: 'XA% / WDA%',
  formula: 'el menor de XA% y WDA%',
  mide: 'Ajuste perceptual y lectura de la realidad',
  // El corte es el que rige en el diccionario, movido por ellas a 0,78.
  escala: binario(0.78, true, 2, true),
  valor: (s) => {
    const xa = num(s, 'calidad_formal', 'XA_pct');
    const wda = num(s, 'calidad_formal', 'WDA_pct');
    if (xa === null && wda === null) return null;
    return Math.min(xa ?? 1, wda ?? 1);
  },
};

const X_MENOS: Indicador = {
  nombre: 'X−%',
  formula: 'X−%',
  mide: 'Distorsión perceptual',
  escala: binario(0.25, false, 2, true),
  valor: (s) => num(s, 'calidad_formal', 'X_menos_pct'),
};

const M_MENOS: Indicador = {
  nombre: 'M−',
  formula: 'M−',
  mide: 'Distorsión en la lectura de los otros',
  escala: binario(1, false),
  valor: (s) => num(s, 'ideacion', 'M_menos'),
};


/**
 * P contra lo esperado para la cantidad de respuestas.
 *
 * Lo esperado sale de R, así que no hay un número fijo que mover: por encima
 * del rango es alto, adentro es medio y por debajo, bajo.
 */
const POPULARES: Indicador = {
  nombre: 'P',
  formula: 'P contra lo esperado para R',
  mide: 'Ajuste a lo convencional',
  reglas: ['por encima de lo esperado para R', 'dentro de lo esperado', 'por debajo de lo esperado'],
  nivel: (s) => {
    const p = num(s, 'procesamiento', 'P') ?? num(s, 'calidad_formal', 'P');
    const r = num(s, 'cabecera', 'R');
    if (p === null || r === null) return null;
    const [minimo, maximo] = pEsperado(r);
    if (p > maximo) return 3;
    return p < minimo ? 1 : 2;
  },
};

const AFR: Indicador = {
  nombre: 'Afr',
  formula: 'Afr contra la banda de su estilo',
  mide: 'Disposición a involucrarse con lo emocional',
  reglas: ['dentro de la banda de su estilo', 'no se usa', 'fuera de la banda de su estilo'],
  nivel: (s) => {
    const afr = num(s, 'afectos', 'Afr');
    const estilo = s.control_estres?.estilo;
    const banda = typeof estilo === 'string' ? bandaDeAfr(estilo) : null;
    if (afr === null || banda?.minimo == null || banda.maximo == null) return null;
    return afr >= banda.minimo && afr <= banda.maximo ? 3 : 1;
  },
};

const INTELECTUALIZACION: Indicador = {
  nombre: 'Índice de intelectualización',
  formula: '2AB + (Art + Ay)',
  mide: 'Distancia intelectual frente a la emoción',
  escala: binario(5, false),
  valor: (s) => num(s, 'ideacion', 'Intelectualizacion') ?? num(s, 'codigos_especiales', 'Intelectualizacion'),
};

const C_PRIMA: Indicador = {
  nombre: "C'",
  formula: "SumC'",
  mide: 'Inhibición o restricción emocional',
  escala: binario(2, false),
  valor: (s) => num(s, 'afectos', 'SumC_prima') ?? num(s, 'determinantes', 'SumC_prima'),
};

const VAGAS: Indicador = {
  nombre: 'Vagas',
  formula: 'DQv',
  mide: 'Grado de desorganización frente a la experiencia',
  escala: binario(2, false),
  valor: (s) => num(s, 'procesamiento', 'DQv') ?? num(s, 'localizacion', 'DQv'),
};

const PSV: Indicador = {
  nombre: 'PSV',
  formula: 'PSV',
  mide: 'Flexibilidad frente a la perseveración',
  // El corte que rige en el diccionario, movido por ellas a 1.
  escala: binario(1, false),
  valor: (s) => num(s, 'codigos_especiales', 'PSV') ?? num(s, 'procesamiento', 'PSV'),
};

const RAVEN: Indicador = {
  nombre: 'Raven',
  formula: 'aciertos sobre 36 láminas',
  mide: 'Razonamiento abstracto',
  escala: { forma: 'umbral', mayorEsMejor: true, alto: 31, medio: 21 },
  valor: (_s, ctx) => ctx?.ravenRaw ?? null,
  datosDe: (ctx) =>
    ctx.ravenRaw === null || ctx.ravenRaw === undefined
      ? undefined
      : `Raven ${ctx.ravenRaw} de 36` +
        (ctx.ravenPercentil === null ? '' : ` · percentil ${Math.round(ctx.ravenPercentil * 10) / 10}`),
};

const T: Indicador = {
  nombre: 'T',
  formula: 'SumT',
  mide: 'Disposición al contacto afectivo',
  escala: dentroDe(1, 1),
  valor: (s) => num(s, 'determinantes', 'SumT') ?? num(s, 'determinantes', 'T'),
};

/** Dd sobre el total de localizaciones: aumentado es negativo. */
const DD: Indicador = {
  nombre: 'Dd',
  formula: 'Dd ÷ (W + D + Dd)',
  mide: 'Priorización',
  escala: binario(0.05, false, 2, true),
  valor: (s) => {
    const w = global(s);
    const d = num(s, 'procesamiento', 'D');
    const dd = num(s, 'procesamiento', 'Dd');
    if (w === null || d === null || dd === null || w + d + dd === 0) return null;
    return dd / (w + d + dd);
  },
};

/**
 * Los contenidos humanos contra lo esperado para R y para el estilo.
 *
 * Es el total (H + (H) + Hd + (Hd)), que es lo que la hoja llama "contenidos
 * H", y el rango sale de la misma tabla que usa el diccionario: cambia con la
 * cantidad de respuestas y con el estilo, así que no hay un número fijo que
 * mover.
 */
const CONTENIDOS_H: Indicador = {
  nombre: 'Contenidos H',
  formula: 'H + (H) + Hd + (Hd) contra lo esperado para R y el estilo',
  mide: 'Interés y apertura hacia los otros',
  reglas: ['por encima de lo esperado', 'dentro de lo esperado', 'por debajo de lo esperado'],
  nivel: (s) => {
    const r = num(s, 'cabecera', 'R');
    const estilo = s.control_estres?.estilo;
    const hPura = num(s, 'autopercepcion', 'H_pura') ?? num(s, 'interpersonal', 'H_pura');
    if (r === null || typeof estilo !== 'string' || hPura === null) return null;
    const humanos =
      hPura +
      (num(s, 'autopercepcion', 'H_paren') ?? 0) +
      (num(s, 'autopercepcion', 'Hd') ?? 0) +
      (num(s, 'autopercepcion', 'Hd_paren') ?? 0);
    const [minimo, maximo] = hEsperado(r, estilo);
    if (humanos > maximo) return 3;
    return humanos < minimo ? 1 : 2;
  },
};

/** H pura contra el resto de los contenidos humanos. */
const H_CONTRA_RESTO: Indicador = {
  nombre: 'H : (H) + Hd + (Hd)',
  formula: 'H pura contra el resto de los contenidos humanos',
  mide: 'Registro de la persona entera y no de sus partes',
  reglas: ['H mayor que el resto', 'no se usa', 'H igual o menor que el resto'],
  nivel: (s) => {
    const hPura = num(s, 'autopercepcion', 'H_pura') ?? num(s, 'interpersonal', 'H_pura');
    if (hPura === null) return null;
    const resto =
      (num(s, 'autopercepcion', 'H_paren') ?? 0) +
      (num(s, 'autopercepcion', 'Hd') ?? 0) +
      (num(s, 'autopercepcion', 'Hd_paren') ?? 0);
    return hPura > resto ? 3 : 1;
  },
};

/**
 * El estrato del potencial, del análisis discursivo.
 *
 * Positivo desde el nivel 2 alto: Especialista en su franja alta, o cualquier
 * estrato por encima. Lo dijeron el 17/9/2026. La franja la carga la evaluadora
 * junto con el estrato; sin estrato cargado el indicador no puntúa, que es
 * distinto de puntuar bajo.
 */
const POTENCIAL: Indicador = {
  nombre: 'Potencial',
  formula: 'el estrato del análisis discursivo',
  mide: 'Hasta dónde puede llegar el nivel de trabajo que sostiene',
  reglas: ['nivel 2 en su franja alta, o un estrato por encima', 'no se usa', 'por debajo de eso'],
  nivel: (_s, ctx) => {
    const nombre = ctx.potencial?.nivel;
    if (!nombre) return null;
    const orden = ESTRATOS.findIndex((e) => e.nombre === nombre);
    if (orden < 0) return null;
    // Los estratos van del 0 (Operativo) para arriba: el 1 es el nivel 2.
    if (orden > 1) return 3;
    return orden === 1 && ctx.potencial?.celda === 'A' ? 3 : 1;
  },
};

/** Afr por debajo de la banda de su estilo; por encima no descuenta. */
const AFR_PISO: Indicador = {
  nombre: 'Afr',
  formula: 'Afr contra el piso de la banda de su estilo',
  mide: 'Disposición a involucrarse con lo emocional',
  reglas: ['desde el piso de la banda de su estilo', 'no se usa', 'por debajo del piso'],
  nivel: (s) => {
    const afr = num(s, 'afectos', 'Afr');
    const estilo = s.control_estres?.estilo;
    const banda = typeof estilo === 'string' ? bandaDeAfr(estilo) : null;
    if (afr === null || banda?.minimo == null) return null;
    return afr >= banda.minimo ? 3 : 1;
  },
};

/** W sobre el total de localizaciones, con sus tres bandas. */
const W_LOCALIZACION: Indicador = {
  nombre: 'W',
  formula: 'W ÷ (W + D + Dd)',
  mide: 'Visión global frente al foco en el detalle',
  // Lo esperado es el 35 % con cinco puntos de tolerancia, como en el
  // diccionario: por encima es alto, adentro medio y por debajo bajo.
  escala: { forma: 'umbral', mayorEsMejor: true, alto: 0.4, medio: 0.3, decimales: 2, porcentaje: true },
  valor: (s) => {
    const w = global(s);
    const d = num(s, 'procesamiento', 'D');
    const dd = num(s, 'procesamiento', 'Dd');
    if (w === null || d === null || dd === null || w + d + dd === 0) return null;
    return w / (w + d + dd);
  },
};

const MIDE = {
  autogestion: 'Coordinación de tareas en función del tiempo. Identificar prioridades. Gestión del cambio.',
  control: 'Tolerancia a la presión. Gestión de las emociones en la resolución de conflictos.',
  interpersonal: 'Negociación. Orientación al cliente externo o interno. Capacidad de comunicación. Empatía.',
  proactividad: 'Orientación al resultado. Iniciativa. Rol activo en los grupos. Gestión de la innovación.',
  intelectual: 'Lectura ajustada de la realidad, esfuerzo de análisis y razonamiento abstracto.',
};

// ── Rorschach ──────────────────────────────────────────────────────────────

const RORSCHACH: { competencia: string; mide: string; indicadores: Indicador[] }[] = [
  {
    competencia: 'Autogestión',
    mide: MIDE.autogestion,
    indicadores: [
      {
        nombre: 'Lambda',
        formula: 'Lambda',
        mide: 'Estilo de afrontamiento y simplificación',
        escala: dentroDe(0.3, 0.99, 2),
        valor: (s) => num(s, 'cabecera', 'Lambda'),
      },
      EB,
      W_M,
      ZD,
      DD,
      T,
    ],
  },
  {
    competencia: 'Control emocional',
    mide: MIDE.control,
    indicadores: [
      {
        nombre: 'EA',
        formula: 'EA',
        mide: 'Recursos disponibles para afrontar demandas',
        escala: { forma: 'umbral', mayorEsMejor: true, alto: 9, medio: 7, decimales: 1 },
        valor: (s) => num(s, 'control_estres', 'EA'),
      },
      {
        nombre: 'D / AdjD',
        formula: 'D y AdjD',
        mide: 'Tolerancia al estrés, inmediata y sostenida',
        reglas: ['D y AdjD en cero o más', 'AdjD en cero o más, D negativo', 'AdjD negativo'],
        nivel: (s) => {
          const d = num(s, 'control_estres', 'D');
          const adj = num(s, 'control_estres', 'AdjD');
          if (d === null || adj === null) return null;
          if (adj >= 0 && d >= 0) return 3;
          if (adj >= 0) return 2;
          return 1;
        },
      },
      INTELECTUALIZACION,
      FC_CF,
      C_PRIMA,
      VAGAS,
      M_Y,
    ],
  },
  {
    competencia: 'Habilidad interpersonal',
    mide: MIDE.interpersonal,
    indicadores: [
      GHR_PHR,
      CONTENIDOS_H,
      AISLAMIENTO,
      AFR,
      M_MENOS,
      POPULARES,
      COP_AG,
      {
        nombre: 'CDI',
        formula: 'CDI',
        mide: 'Inhabilidad social',
        // La constelación positiva (cuatro o cinco) es lo negativo.
        escala: binario(3, false),
        valor: (s) => constelacion(s, 'CDI'),
      },
      EGOCENTRISMO,
    ],
  },
  {
    competencia: 'Proactividad',
    mide: MIDE.proactividad,
    indicadores: [
      FD,
      MA_MP,
      {
        nombre: 'R',
        formula: 'R',
        mide: 'Nivel general de productividad e iniciativa de respuesta',
        escala: { forma: 'umbral', mayorEsMejor: true, alto: 29, medio: 17 },
        valor: (s) => num(s, 'cabecera', 'R'),
      },
    ],
  },
  {
    competencia: 'Capacidad intelectual',
    mide: MIDE.intelectual,
    indicadores: [
      XA_WDA,
      X_MENOS,
      {
        nombre: 'Zf',
        formula: 'Zf contra R',
        mide: 'Esfuerzo de organización',
        reglas: ['más del 55 % de R', 'entre el 30 % y el 55 % de R', 'menos del 30 % de R'],
        nivel: (s) => {
          const zf = num(s, 'procesamiento', 'Zf');
          const r = num(s, 'cabecera', 'R');
          if (zf === null || r === null || r === 0) return null;
          if (zf > r * 0.55) return 3;
          return zf < r * 0.3 ? 1 : 2;
        },
      },
      ZD,
      PSV,
      RAVEN,
    ],
  },
  {
    /**
     * Liderazgo lo definieron el 17/9/2026, después que las otras cinco.
     *
     * Va solo en Rorschach: dos de sus indicadores (Afr y el potencial) no
     * existen en un Zulliger, que no tiene proporción afectiva ni se toma con
     * análisis discursivo.
     */
    competencia: 'Liderazgo',
    mide: 'Visión global frente al foco en el detalle. Gestión de personas. Capacidad de decisión.',
    indicadores: [
      GHR_PHR,
      W_LOCALIZACION,
      EB,
      H_CONTRA_RESTO,
      POTENCIAL,
      CONTENIDOS_H,
      AFR_PISO,
    ],
  },
];

// ── Zulliger ───────────────────────────────────────────────────────────────

const ZULLIGER: { competencia: string; mide: string; indicadores: Indicador[] }[] = [
  {
    competencia: 'Autogestión',
    mide: MIDE.autogestion,
    indicadores: [
      {
        nombre: 'Lambda',
        formula: 'Lambda',
        mide: 'Estilo de afrontamiento y simplificación',
        // La banda del Zulliger, con el techo que ellas movieron a 0,80.
        escala: dentroDe(0.29, 0.8, 2),
        valor: (s) => num(s, 'cabecera', 'Lambda'),
      },
      EB,
      W_M,
      {
        nombre: 'Dd',
        formula: 'Dd',
        mide: 'Priorización',
        // En Zulliger la localización se lee por cantidad: hasta dos Dd.
        escala: binario(2, false),
        valor: (s) => num(s, 'procesamiento', 'Dd') ?? num(s, 'localizacion', 'Dd'),
      },
      { ...T, escala: dentroDe(0, 0) },
    ],
  },
  {
    competencia: 'Control emocional',
    mide: MIDE.control,
    indicadores: [
      {
        nombre: 'EA',
        formula: 'EA',
        mide: 'Recursos disponibles para afrontar demandas',
        escala: { forma: 'umbral', mayorEsMejor: true, alto: 5, medio: 3, decimales: 1 },
        valor: (s) => num(s, 'control_estres', 'EA'),
      },
      {
        nombre: 'EA − es',
        formula: 'EA − es',
        mide: 'Tolerancia al estrés',
        // Hasta −1,5 es lo esperado; por debajo, la demanda supera al recurso.
        escala: binario(-1.5, true, 1),
        valor: (s) => num(s, 'control_estres', 'dif_EA_es'),
      },
      { ...INTELECTUALIZACION, escala: binario(1, false) },
      FC_CF,
      C_PRIMA,
      { ...VAGAS, escala: binario(0, false) },
      M_Y,
    ],
  },
  {
    competencia: 'Habilidad interpersonal',
    mide: MIDE.interpersonal,
    indicadores: [
      GHR_PHR,
      CONTENIDOS_H,
      AISLAMIENTO,
      { ...M_MENOS, escala: binario(0, false) },
      POPULARES,
      COP_AG,
      { ...EGOCENTRISMO, escala: binario(0.56, false, 2) },
    ],
  },
  {
    competencia: 'Proactividad',
    mide: MIDE.proactividad,
    indicadores: [
      FD,
      MA_MP,
      {
        nombre: 'R',
        formula: 'R',
        mide: 'Nivel de productividad y compromiso con la tarea',
        escala: { forma: 'umbral', mayorEsMejor: true, alto: 12, medio: 9 },
        valor: (s) => num(s, 'cabecera', 'R'),
      },
    ],
  },
  {
    competencia: 'Capacidad intelectual',
    mide: MIDE.intelectual,
    indicadores: [XA_WDA, X_MENOS, { ...PSV, escala: binario(0, false) }, RAVEN],
  },
];

/**
 * Las dos hojas, para la pantalla que deja mover los pesos.
 *
 * Se exportan las mismas constantes que usa el cálculo, así que la pantalla no
 * puede quedar mostrando indicadores que ya no existen ni perderse uno nuevo.
 */
export const HOJAS: Record<string, { competencia: string; mide: string; indicadores: Indicador[] }[]> =
  { Rorschach: RORSCHACH, Zulliger: ZULLIGER };

/**
 * Cómo se nombra un peso para poder guardarlo.
 *
 * Por nombre y no por posición: mover un indicador de lugar en el arreglo, o
 * sumar otro arriba, no puede hacer que el peso que alguien puso en la calidad
 * del vínculo termine aplicado al índice de egocentrismo.
 */
export function claveDePeso(test: string, competencia: string, indicador: string): string {
  return `${test}·${competencia}·${indicador}`;
}

/** Lo que pesa cada indicador en el código. */
export const PESOS_DE_FABRICA: Record<string, number> = Object.fromEntries(
  Object.entries(HOJAS).flatMap(([test, hoja]) =>
    hoja.flatMap((c) =>
      c.indicadores.map((i) => [claveDePeso(test, c.competencia, i.nombre), i.peso ?? 1])
    )
  )
);

/**
 * Los números de corte que trae el código, por indicador.
 *
 * Se guardan bajo la misma clave que el peso: un indicador es el mismo tenga
 * uno u otro, y así hay una sola forma de nombrarlo en toda la configuración.
 */
export const CORTES_DE_FABRICA: Record<string, number[]> = Object.fromEntries(
  Object.entries(HOJAS).flatMap(([test, hoja]) =>
    hoja.flatMap((c) =>
      c.indicadores
        .filter((i) => i.escala)
        .map((i) => [claveDePeso(test, c.competencia, i.nombre), numerosDe(i.escala as Escala)])
    )
  )
);

/** Los cortes que rigen para un indicador: los movidos, y si no los del código. */
function cortesQueRigen(
  test: string,
  competencia: string,
  i: Indicador,
  movidos: Record<string, number[]> | undefined
): number[] | undefined {
  if (!i.escala) return undefined;
  return movidos?.[claveDePeso(test, competencia, i.nombre)] ?? numerosDe(i.escala);
}

/** La escala que rige: la del código con la dirección que se haya elegido. */
export function escalaQueRige(
  test: string,
  competencia: string,
  i: Indicador,
  direcciones: Record<string, boolean> | undefined
): Escala | undefined {
  if (!i.escala) return undefined;
  return conDireccion(i.escala, direcciones?.[claveDePeso(test, competencia, i.nombre)]);
}

/**
 * Lo guardado para las direcciones, si sirve; null si no.
 *
 * Se rechaza una clave que no corte por umbral: una banda no tiene un "hacia
 * arriba" que invertir, y guardarle una dirección sería guardar algo que nadie
 * va a leer.
 */
export function direccionesValidas(guardadas: unknown): Record<string, boolean> | null {
  if (!guardadas || typeof guardadas !== 'object' || Array.isArray(guardadas)) return null;
  const conUmbral = new Set<string>();
  for (const [test, hoja] of Object.entries(HOJAS)) {
    for (const c of hoja) {
      for (const i of c.indicadores) {
        if (i.escala?.forma === 'umbral') conUmbral.add(claveDePeso(test, c.competencia, i.nombre));
      }
    }
  }
  const limpias: Record<string, boolean> = {};
  for (const [clave, valor] of Object.entries(guardadas as Record<string, unknown>)) {
    if (!conUmbral.has(clave) || typeof valor !== 'boolean') return null;
    limpias[clave] = valor;
  }
  return limpias;
}

/**
 * Las bandas de un indicador en una línea, para el desglose del informe.
 *
 * En un binario las dos bandas de arriba son la misma, así que la del medio se
 * saltea: "hasta 0,05 alto; hasta 0,05 medio" decía dos veces lo mismo y hacía
 * creer que había un punto medio donde no lo hay.
 */
function comoSeLee(i: Indicador, n: number[] | undefined, e?: Escala): string {
  const bandas = ([0, 1, 2] as const).map((cual) =>
    reglaDeBanda(e ?? i.escala, n, cual, i.reglas)
  );
  const partes = bandas
    .map((regla, cual) => [regla, ['alto', 'medio', 'bajo'][cual]] as const)
    .filter(([regla], cual) => regla && regla !== 'no se usa' && !(cual === 1 && regla === bandas[0]))
    .map(([regla, banda]) => `${regla} ${banda}`);
  return partes.join('; ');
}

/**
 * Lo guardado, si sirve para calcular; null si no.
 *
 * Se rechaza una clave que no tenga escala, un arreglo de largo distinto al que
 * esa escala pide, cualquier valor que no sea un número finito, y una escala
 * cuyos números queden desordenados: en un umbral, alto y medio del lado que
 * corresponde a su dirección, y en una banda, cada intervalo con el desde antes
 * del hasta. Un corte dado vuelta no da un criterio distinto, da uno que no se
 * cumple nunca.
 */
export function cortesDeCompetenciasValidos(
  guardados: unknown
): Record<string, number[]> | null {
  if (!guardados || typeof guardados !== 'object' || Array.isArray(guardados)) return null;
  const porClave = new Map<string, Escala>();
  for (const [test, hoja] of Object.entries(HOJAS)) {
    for (const c of hoja) {
      for (const i of c.indicadores) {
        if (i.escala) porClave.set(claveDePeso(test, c.competencia, i.nombre), i.escala);
      }
    }
  }
  const limpios: Record<string, number[]> = {};
  for (const [clave, valor] of Object.entries(guardados as Record<string, unknown>)) {
    const e = porClave.get(clave);
    if (!e) return null;
    if (!Array.isArray(valor) || valor.length !== numerosDe(e).length) return null;
    const n = valor as unknown[];
    if (!n.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
    const num = n as number[];
    if (e.forma === 'umbral') {
      if (e.mayorEsMejor ? num[0] < num[1] : num[0] > num[1]) return null;
    } else if (num[0] > num[1] || num[2] > num[3]) {
      return null;
    }
    limpios[clave] = num;
  }
  return limpios;
}

/** Hasta cuánto puede pesar un indicador. */
export const PESO_MAXIMO = 5;

/**
 * Lo guardado, si sirve para calcular; null si no.
 *
 * Tres cosas se rechazan. Una clave que no existe en las hojas, porque sería un
 * peso que no se aplica a nada y que nadie va a ver para corregir. Un peso que
 * no es un entero de 0 a {@link PESO_MAXIMO}. Y dejar una competencia entera en
 * cero: el promedio se queda sin divisor y esa competencia sale sin puntaje en
 * todos los informes, que no es lo que quiso hacer quien movió un número.
 *
 * **Cero sí vale para un indicador**: es sacarlo del promedio dejándolo a la
 * vista en el detalle, que es lo que se quiere cuando se desconfía de uno.
 */
export function pesosValidos(guardados: unknown): Record<string, number> | null {
  if (!guardados || typeof guardados !== 'object' || Array.isArray(guardados)) return null;
  const entradas = Object.entries(guardados as Record<string, unknown>);
  const limpios: Record<string, number> = {};
  for (const [clave, valor] of entradas) {
    if (!(clave in PESOS_DE_FABRICA)) return null;
    if (typeof valor !== 'number' || !Number.isInteger(valor)) return null;
    if (valor < 0 || valor > PESO_MAXIMO) return null;
    limpios[clave] = valor;
  }
  for (const [test, hoja] of Object.entries(HOJAS)) {
    for (const c of hoja) {
      const suma = c.indicadores.reduce(
        (n, i) => n + (limpios[claveDePeso(test, c.competencia, i.nombre)] ?? i.peso ?? 1),
        0
      );
      if (suma === 0) return null;
    }
  }
  return limpios;
}

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
export function puntajeDeRaven(raw: number, rangos?: Rango[]): number | null {
  const rango = rangoDe(raw, rangos);
  if (!rango) return null;

  const banda = BANDA_POR_RANGO[rango.numeral];
  const tramo = puntajesPorRango(rangos).get(rango.numeral);
  if (!banda || !tramo) return null;

  const piso = percentilDe(tramo.desde);
  const techo = percentilDe(tramo.hasta);
  const suyo = percentilDe(raw);
  if (piso === null || techo === null || suyo === null) return null;

  const dentro = techo > piso ? (suyo - piso) / (techo - piso) : 0;
  return Math.round(banda[0] + dentro * (banda[1] - banda[0]));
}

/** Cómo se nombra el rango en el que cayó. */
function rangoRaven(raw: number, rangos?: Rango[]): string | undefined {
  const r = rangoDe(raw, rangos);
  return r ? `Rango ${r.numeral} · ${r.nombre.toLowerCase()}` : undefined;
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
// El mismo corte con el que el diccionario nombra el estilo evitativo: lo
// esperado llega hasta 0,99 y de ahí para arriba el protocolo simplifica.
// Definido por las psicólogas el 9/9/2026.
const LAMBDA_MAXIMO = 0.99;

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
  const test = proyectivo === 'Zulliger' ? 'Zulliger' : 'Rorschach';
  const juego = HOJAS[test];
  const base = protocoloAlcanza(s, proyectivo);

  const medidas = juego.map((c) => {
    const renglones = c.indicadores.map((i) => {
      const n = cortesQueRigen(test, c.competencia, i, ctx.cortesCompetencias);
      const e = escalaQueRige(test, c.competencia, i, ctx.direcciones);
      const leer = (sumario: SumarioCrudo) => nivelDe(i, sumario, n, e, ctx);
      return {
        indicador: i.nombre,
        mide: i.mide,
        nivel: leer(s),
        corte: comoSeLee(i, n, e),
        peso: ctx.pesos?.[claveDePeso(test, c.competencia, i.nombre)] ?? i.peso ?? 1,
        datos: i.datosDe ? i.datosDe(ctx) : leidoPor(s, leer),
      };
    });

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

    // Un indicador en cero está apagado a propósito: no entra al promedio y
    // tampoco cuenta como dato que falta, porque nadie lo está esperando.
    const cuentan = renglones.filter((r) => r.peso > 0);
    const puntuados = cuentan.filter((r) => r.nivel !== null);
    // Con dos o más indicadores sin dato se dice que falta, en vez de informar
    // un número que se apoya en la mitad del protocolo.
    if (cuentan.length - puntuados.length > 1) {
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

  return medidas;
}

/**
 * Cómo se nombra cada puntaje en el informe.
 *
 * **Ya no vive acá.** Dónde corta cada banda es una decisión de negocio y no
 * una propiedad del test, así que son perfiles guardados: `lib/exigencia.ts`.
 * El pedido, o un candidato en particular, puede llevar uno menos exigente sin
 * que ninguna competencia se recalcule.
 */
export { bandaDe, bandasDe, type Banda } from '@/lib/exigencia';


/**
 * Por qué el puntaje no lleva el signo de porcentaje.
 *
 * Un número con `%` se lee como nota de examen, donde sesenta es raspando, y
 * acá sesenta es un desempeño adecuado. Es un puntaje sobre cien, no un
 * porcentaje de aciertos. El informe lo dibuja sobre la escala de las cuatro
 * bandas (`EscalaBandas`, en `Documento.tsx`), para que el número no quede
 * solo.
 */
