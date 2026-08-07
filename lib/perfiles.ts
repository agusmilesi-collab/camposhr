/**
 * Cuestionario de Perfil (Benziger adaptado) — perfiles y puntaje.
 *
 * Cuatro perfiles. Cada uno recibe dos puntajes:
 *   - una placa descriptiva, escala 0 a 5   -> 0 a 5 puntos
 *   - una placa de 15 frases, una por tilde -> 0 a 15 puntos
 * El total por perfil va de 0 a 20.
 *
 * Regla de resultado (UMBRAL = 13, se cuenta a partir de 14):
 *   - dos o más perfiles por encima del umbral -> perfil doble (los dos más altos)
 *   - uno solo por encima                      -> perfil definido
 *   - ninguno por encima                       -> perfil mixto, encabezado por el más alto
 */

export const PERFILES = ['FI', 'FD', 'BI', 'BD'] as const;
export type Perfil = (typeof PERFILES)[number];

export type Puntajes = Record<Perfil, number>;

export const UMBRAL = 13;

/** Máximo posible por perfil: 5 de la placa descriptiva + 15 de la checklist. */
export const MAXIMO = 20;

export const INFO: Record<
  Perfil,
  { nombre: string; corto: string; descripcion: string }
> = {
  FI: {
    nombre: 'Frontal Izquierdo',
    corto: 'FI',
    descripcion:
      'Análisis financiero, estructural y matemático. Evaluar todas las variables, sin emoción. Tomar decisiones lógicas. Asignar prioridades.',
  },
  FD: {
    nombre: 'Frontal Derecho',
    corto: 'FD',
    descripcion:
      'Imaginativos, metafóricos, visionarios, creativos y espaciales. Tomadores de riesgo. Se centran en inventar y experimentar.',
  },
  BI: {
    nombre: 'Basal Izquierdo',
    corto: 'BI',
    descripcion:
      'Monitoreo y control. Poner atención a los detalles. Seguimiento de procedimientos. Mantener planificaciones. Mantener procesos administrativos.',
  },
  BD: {
    nombre: 'Basal Derecho',
    corto: 'BD',
    descripcion:
      'Sensibles, promueven la armonía en los grupos. Se conectan con el entorno y en especial con otros para ayudarlos o alentarlos. Empáticos.',
  },
};

/**
 * Qué mirada aporta cada cuadrante en una consulta.
 *
 * Es lo que la otra persona ve y uno no: por eso se completa la frase "te
 * puede aportar…". Sale de la descripción de cada modo, dicho como lo que hace
 * cuando le acercás una decisión.
 */
export const APORTA: Record<Perfil, string> = {
  FI: 'los números y las variables que la decisión toca, y en qué orden conviene resolverlas',
  FD: 'una salida distinta a la que estás viendo, y el permiso para probar algo que todavía no existe',
  BI: 'el detalle que falta, el paso que se saltea y lo que se rompe cuando eso se lleva a la práctica',
  BD: 'cómo va a caer eso en las personas, y qué vínculo se resiente si sale mal',
};


/**
 * Qué le puede aportar cada cuadrante a cada otro, en el trabajo.
 *
 * Se lee `ENTRE[mío][suyo]`. La frase dice hacia dónde va la mirada propia,
 * qué ve el otro desde la suya y en qué momento conviene consultarle. Es la
 * consigna de la charla 3 puesta en concreto: la diferencia sirve cuando cada
 * uno sabe para qué le sirve la del otro.
 */
export const ENTRE: Record<Perfil, Record<Perfil, string>> = {
  FI: {
    FD: 'Vos evaluás las variables y elegís la mejor entre las opciones que tenés. Él propone opciones que no habías considerado. Consultale antes de decidir, cuando todavía se puede cambiar el planteo.',
    BI: 'Vos definís qué conviene hacer. Él ve qué hace falta para que eso funcione: los pasos, los tiempos y quién hace cada cosa. Consultale cómo se implementa lo que decidiste.',
    BD: 'Vos mirás el problema. Él mira a la gente que va a recibir la decisión. Preguntale cómo va a caer y con quién conviene hablar antes de comunicarla.',
    FI: '',
  },
  FD: {
    FI: 'Vos pensás qué se podría hacer. Él calcula cuál de esas ideas entra en el presupuesto y en el tiempo que hay. Llevásela para que te diga qué haría falta para poder hacerla.',
    BI: 'Vos proponés formas nuevas de hacer las cosas. Él sabe qué hay que cambiar en el trabajo de todos los días para que eso ocurra. Preguntale qué pasos hay que armar para que tu idea no quede en la nada.',
    BD: 'Vos pensás en qué cambiar. Él piensa en cómo lo va a vivir el equipo. Consultale a quién le cambia el trabajo tu propuesta y de qué forma se lo dirías.',
    FD: '',
  },
  BI: {
    FI: 'Vos cuidás que el proceso se cumpla. Él mira si conviene hacerlo. Preguntale qué prioriza y qué se puede resignar cuando no entra todo.',
    FD: 'Vos sostenés lo que ya funciona. Él propone hacerlo de otra manera. Escuchá su idea antes de medirla contra el procedimiento: puede ahorrarte pasos.',
    BD: 'Vos seguís el plan. Él se da cuenta cuándo alguien del equipo dejó de participar o está haciendo lo mínimo. Consultale qué está pasando con la gente cuando algo se atrasa sin motivo visible.',
    BI: '',
  },
  BD: {
    FI: 'Vos leés al equipo. Él lee los números. Consultale qué dice el dato cuando tenés que sostener una decisión que sabés que no va a caer bien.',
    FD: 'Vos cuidás el clima. Él propone cambios. Preguntale qué haría distinto: muchas veces lo que desgasta al equipo se arregla cambiando la forma de trabajar.',
    BI: 'Vos ves cómo está cada uno. Él ve cómo está el trabajo. Consultale cómo repartir las tareas para que la carga deje de caer siempre sobre los mismos.',
    BD: '',
  },
};

/**
 * El cuadrante opuesto en diagonal.
 *
 * Lo dice el guion de la charla 3, en la nota de la placa de fortaleza y
 * dificultad: donde una persona rinde sin esfuerzo, la de su diagonal se
 * exige, y al revés. Por eso es el cruce que más le muestra a cada uno, y el
 * que la charla usa para armar las consultas de a dos.
 */
export const DIAGONAL: Record<Perfil, Perfil> = {
  FI: 'BD',
  BD: 'FI',
  FD: 'BI',
  BI: 'FD',
};

/**
 * Lectura de un puntaje suelto, de 0 a 20.
 *
 * Un cuadrante puede estar por debajo del umbral y aun así ser el más alto de
 * la persona: son dos lecturas distintas y el informe necesita las dos. Acá va
 * la absoluta; la relativa (cuál encabeza) sale del orden de los cuatro.
 */
export type Nivel = 'evita' | 'competente' | 'prefiere';

export const NIVELES: Record<Nivel, { titulo: string; texto: string }> = {
  evita: {
    titulo: 'Lo evita',
    texto:
      'Es la forma de pensar que menos usa. Las tareas de este tipo le cuestan mucho y las posterga o las delega.',
  },
  competente: {
    titulo: 'Es competente',
    texto:
      'Habilidad desarrollada pero no preferida. Puede usarla cuando hace falta, aunque le implica esfuerzo y la agota si se sostiene.',
  },
  prefiere: {
    titulo: 'Lo prefiere',
    texto:
      'Es su forma natural de pensar. Le sale sin esfuerzo y es donde rinde más.',
  },
};

export function nivel(puntaje: number): Nivel {
  if (puntaje <= 5) return 'evita';
  if (puntaje <= UMBRAL - 1) return 'competente';
  return 'prefiere';
}

/**
 * Si ningún cuadrante supera el umbral, la persona no tiene una preferencia
 * marcada: usa los cuatro en un nivel parejo. El más alto sigue siendo su
 * inclinación, pero conviene decirlo con esa reserva.
 */
export function esParejo(totales: Puntajes): boolean {
  return PERFILES.every((p) => totales[p] <= UMBRAL);
}

export type Resultado = {
  totales: Puntajes;
  perfiles: Perfil[];
  tipo: 'definido' | 'doble' | 'mixto';
  ejeX: number; // -1 izquierdo … 1 derecho
  ejeY: number; // -1 basal (micro) … 1 frontal (macro)
};

/**
 * Ubicación de una persona en la matriz, a partir de sus cuatro totales.
 *
 * Cada eje enfrenta el puntaje más alto de un lado contra el más alto del
 * otro: izquierda es el mayor entre FI y BI, derecha el mayor entre FD y BD,
 * y lo mismo arriba y abajo. Así el punto siempre cae en el cuadrante del
 * perfil que encabeza el resultado, que es el nombre que la persona lee arriba
 * de la matriz. Sumar los dos cuadrantes de cada lado no daba esa garantía:
 * con FI 0, FD 11, BI 13 y BD 3 el titular decía Basal Izquierdo y el punto
 * caía en Basal Derecho, porque el cero de FI le restaba peso al lado
 * izquierdo aunque BI fuera el más alto de los cuatro.
 *
 * Se mide la proporción entre los dos lados y no la diferencia en puntos: así
 * quien marcó pocas frases y quien marcó muchas se comparan igual. Después se
 * expande con una raíz, porque las diferencias reales son chicas y sin eso
 * todo el grupo queda apelotonado en el centro. El orden entre personas no
 * cambia: solo se usa mejor el cuadro.
 */
export function coordenadas(totales: Puntajes): { x: number; y: number } {
  const izquierda = Math.max(totales.FI, totales.BI);
  const derecha = Math.max(totales.FD, totales.BD);
  const arriba = Math.max(totales.FI, totales.FD);
  const abajo = Math.max(totales.BI, totales.BD);

  return {
    x: proporcion(derecha, izquierda),
    y: proporcion(arriba, abajo),
  };
}

/** Cuánto se despega un lado del opuesto, de -1 a 1. */
function proporcion(positivo: number, negativo: number): number {
  const suma = positivo + negativo;
  if (suma === 0) return 0;
  return expandir((positivo - negativo) / suma);
}

/** Estira los valores cercanos a cero, conservando el signo y el orden. */
function expandir(v: number): number {
  return redondear(Math.sign(v) * Math.abs(v) ** 0.8);
}

export function totalizar(likert: Puntajes, checklist: Puntajes): Puntajes {
  return {
    FI: likert.FI + checklist.FI,
    FD: likert.FD + checklist.FD,
    BI: likert.BI + checklist.BI,
    BD: likert.BD + checklist.BD,
  };
}

export function calcular(likert: Puntajes, checklist: Puntajes): Resultado {
  const totales = totalizar(likert, checklist);

  const ranking = [...PERFILES].sort((a, b) => totales[b] - totales[a]);
  const superan = ranking.filter((p) => totales[p] > UMBRAL);

  let perfiles: Perfil[];
  let tipo: Resultado['tipo'];
  if (superan.length >= 2) {
    perfiles = superan.slice(0, 2);
    tipo = 'doble';
  } else if (superan.length === 1) {
    perfiles = superan;
    tipo = 'definido';
  } else {
    perfiles = [ranking[0]];
    tipo = 'mixto';
  }

  // Cada persona cae en un punto único del plano: quien reparte parejo queda
  // cerca del centro, quien concentra en un lado se va hacia el borde.
  const { x, y } = coordenadas(totales);

  return { totales, perfiles, tipo, ejeX: x, ejeY: y };
}

function redondear(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Etiqueta del resultado para mostrarle a la persona. */
export function etiqueta(r: Pick<Resultado, 'perfiles' | 'tipo'>): string {
  const nombres = r.perfiles.map((p) => INFO[p].nombre);
  if (r.tipo === 'doble') return `${nombres[0]} y ${nombres[1]}`;
  return nombres[0];
}
