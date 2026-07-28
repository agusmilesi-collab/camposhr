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

export type Resultado = {
  totales: Puntajes;
  perfiles: Perfil[];
  tipo: 'definido' | 'doble' | 'mixto';
  ejeX: number; // -1 izquierdo … 1 derecho
  ejeY: number; // -1 basal (micro) … 1 frontal (macro)
};

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

  // Coordenadas continuas: cada persona cae en un punto único del plano.
  // Quien reparte parejo queda cerca del centro; quien concentra, en el borde.
  const horizontal = totales.FD + totales.BD - (totales.FI + totales.BI);
  const vertical = totales.FI + totales.FD - (totales.BI + totales.BD);
  const escala = MAXIMO * 2; // rango de cada diferencia: -40 a 40

  return {
    totales,
    perfiles,
    tipo,
    ejeX: redondear(horizontal / escala),
    ejeY: redondear(vertical / escala),
  };
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
