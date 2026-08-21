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
 * Los cinco rangos, por puntaje directo.
 *
 * Cortan por aciertos y no por percentil: es el corte que usa el equipo, y el
 * puntaje directo es lo que se carga y lo que se compara entre candidatos de
 * una misma búsqueda.
 *
 * La frecuencia entre paréntesis dice qué tan raro es cada nivel, y está
 * calculada contra la población que evalúa Campos HR (media 21,11 aciertos,
 * desvío 7,10 sobre los primeros 35 candidatos), no contra el baremo español
 * del manual, que rinde casi tres puntos menos. Se recalcula cuando haya
 * suficientes casos: hasta entonces es una estimación de una muestra chica.
 *
 * El numeral romano los ordena de mayor a menor.
 */
export type Rango = {
  numeral: string;
  nombre: string;
  frecuencia: string;
  /** Desde cuántos aciertos empieza. */
  desde: number;
};

export const RANGOS: Rango[] = [
  { numeral: 'I', nombre: 'Superioridad intelectual', frecuencia: '1 de cada 69 candidatos', desde: 35 },
  { numeral: 'II', nombre: 'Superior al término medio', frecuencia: '1 de cada 16 candidatos', desde: 31 },
  { numeral: 'III', nombre: 'Término medio', frecuencia: '1 de cada 2 candidatos', desde: 21 },
  { numeral: 'IV', nombre: 'Inferior al término medio', frecuencia: '1 de cada 3 candidatos', desde: 11 },
  { numeral: 'V', nombre: 'Deficiencia intelectual', frecuencia: '1 de cada 15 candidatos', desde: 0 },
];

/** Cómo se escribe un rango. Es lo que queda guardado, así que no cambia. */
export function textoDelRango(r: Rango): string {
  return `Rango ${r.numeral} · ${r.nombre} (${r.frecuencia})`;
}

/** El rango de un puntaje directo. */
export function rangoDe(aciertos: number): Rango | null {
  return RANGOS.find((r) => aciertos >= r.desde) ?? null;
}

/** Entre qué puntajes cae cada rango, para dibujar la escala. */
export function puntajesPorRango(): Map<string, { desde: number; hasta: number }> {
  const tramos = new Map<string, { desde: number; hasta: number }>();
  RANGOS.forEach((r, i) => {
    tramos.set(r.numeral, { desde: r.desde, hasta: i === 0 ? RAVEN_MAXIMO : RANGOS[i - 1].desde - 1 });
  });
  return tramos;
}

/** Lo que no se rindió no se interpreta: no se declara nada sobre alguien sin puntaje. */
export const SIN_MEDICION = 'Sin medición';

/** Cuánto tardó, escrito como el reloj del test: minutos y segundos. */
export function duracion(segundos: number | null): string | null {
  if (segundos === null || !Number.isFinite(segundos)) return null;
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

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
  const rango = rangoDe(aciertos);
  const resultado = rango ? textoDelRango(rango) : SIN_MEDICION;

  return { raw: aciertos, percentil, desvios, resultado };
}
