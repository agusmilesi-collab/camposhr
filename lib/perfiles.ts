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
