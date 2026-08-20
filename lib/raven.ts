/**
 * El Raven: del puntaje directo al rango intelectual.
 *
 * El puntaje directo es la cantidad de aciertos sobre 36. De ahí salen tres
 * cosas, y ninguna se inventa acá: son las mismas fórmulas que corrían en
 * Airtable, traídas tal cual.
 *
 * El percentil sale de una tabla y no de una cuenta: es el baremo del manual
 * del test (Tabla S5, Escala Superior, columna G. Medio, N=727, media 18,19 y
 * desvío 6,32), con el modelo normal ajustado a sus siete anclas. Por encima
 * de 28 aciertos es extrapolación: el ancla más alta del manual es 28, que da
 * percentil 95.
 */

/** Aciertos posibles: el test tiene treinta y seis láminas. */
export const RAVEN_MAXIMO = 36;

/** Cuánto dura el test, en minutos. */
export const MINUTOS = 45;

/** Cuándo se avisa que se está por terminar. */
export const AVISO_MINUTOS = 5;

/** Cuántas opciones tiene cada lámina. */
export const OPCIONES = 8;

/**
 * Qué porcentaje de la población de referencia queda por debajo.
 *
 * No es el porcentaje de respuestas correctas: para eso está el puntaje
 * directo. Percentil 50 es el promedio exacto, no "la mitad mal".
 */
const PERCENTIL: Record<number, number> = {
  0: 0.2, 1: 0.3, 2: 0.5, 3: 0.8, 4: 1.2, 5: 1.8, 6: 2.7, 7: 3.8, 8: 5.3,
  9: 7.3, 10: 9.8, 11: 12.8, 12: 16.4, 13: 20.6, 14: 25.4, 15: 30.7, 16: 36.4,
  17: 42.5, 18: 48.8, 19: 55.1, 20: 61.3, 21: 67.2, 22: 72.7, 23: 77.7,
  24: 82.1, 25: 85.9, 26: 89.2, 27: 91.8, 28: 94.0, 29: 95.6, 30: 96.9,
  31: 97.9, 32: 98.6, 33: 99.0, 34: 99.4, 35: 99.6, 36: 99.8,
};

/** La media y el desvío del baremo, en aciertos. Si cambia el baremo, cambian. */
const MEDIA = 18.19;
const DESVIO = 6.32;

/**
 * Los cinco rangos, con su frecuencia entre paréntesis.
 *
 * El "1 de cada N" dice qué tan raro es el nivel sin exponer el percentil, que
 * un cliente puede leer como nota de colegio. El numeral romano los ordena de
 * mayor a menor.
 */
const RANGOS: { desde: number; texto: string }[] = [
  { desde: 95, texto: 'Rango I · Superioridad intelectual (1 de cada 20 candidatos)' },
  { desde: 75, texto: 'Rango II · Superior al término medio (1 de cada 5 candidatos)' },
  { desde: 25.0001, texto: 'Rango III · Término medio (1 de cada 2 candidatos)' },
  { desde: 5.0001, texto: 'Rango IV · Inferior al término medio (1 de cada 5 candidatos)' },
  { desde: -Infinity, texto: 'Rango V · Deficiencia intelectual (1 de cada 20 candidatos)' },
];

/** Lo que no se rindió no se interpreta: no se declara nada sobre alguien sin puntaje. */
export const SIN_MEDICION = 'Sin medición';

export type Raven = {
  raw: number;
  percentil: number | null;
  desvios: number | null;
  resultado: string;
};

export function calcularRaven(raw: number | null): Raven | null {
  if (raw === null || raw === undefined || !Number.isFinite(raw)) return null;
  const aciertos = Math.round(raw);
  if (aciertos < 0 || aciertos > RAVEN_MAXIMO) return null;

  const percentil = PERCENTIL[aciertos] ?? null;
  // Distancia a la media del baremo, en desvíos. Es de uso interno: sirve para
  // desempatar dos candidatos que caen en el mismo rango, donde el percentil
  // se comprime.
  const desvios = Math.round(((aciertos - MEDIA) / DESVIO) * 10) / 10;
  const resultado =
    percentil === null
      ? SIN_MEDICION
      : (RANGOS.find((r) => percentil >= r.desde)?.texto ?? SIN_MEDICION);

  return { raw: aciertos, percentil, desvios, resultado };
}
