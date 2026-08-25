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

/** El percentil de un puntaje directo, para quien necesite el baremo suelto. */
export function percentilDe(aciertos: number): number | null {
  return PERCENTIL[aciertos] ?? null;
}

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
 * **La frecuencia es la que rige y se escribe acá.** Está calculada contra la
 * población que evalúa Campos HR (media 21,11 aciertos, desvío 7,10 sobre los
 * primeros 35 candidatos), no contra el baremo español del manual, que rinde
 * casi tres puntos menos.
 *
 * Al lado se cuenta la de los casos propios, que se va corrigiendo con cada
 * Raven que entra (`lib/raven-propio.ts`), y se muestra en Configuración con
 * cuántos casos lleva. **Esa todavía no rige**: reemplaza a la de acá el día
 * que se llegue a los 200 casos y se cambien estos números a mano. Hasta
 * entonces son dos columnas al lado, para poder ver cuánto se separan.
 *
 * El numeral romano los ordena de mayor a menor.
 */
export type Rango = {
  numeral: string;
  nombre: string;
  /** Qué tan raro es. La que rige hoy; la propia se cuenta aparte. */
  frecuencia: string;
  /** Desde cuántos aciertos empieza. */
  desde: number;
};

/**
 * Los cinco cortes de fábrica.
 *
 * Se pueden mover desde Sistema → Baremo del Raven, que es donde se decide si
 * el sistema pide más o menos para cada rango. Lo que se guarda ahí pisa esto;
 * mientras nadie lo toque, rige lo de acá.
 */
export const RANGOS: Rango[] = [
  { numeral: 'I', nombre: 'Superioridad intelectual', frecuencia: '1 de cada 69 candidatos', desde: 35 },
  { numeral: 'II', nombre: 'Superior al término medio', frecuencia: '1 de cada 16 candidatos', desde: 31 },
  { numeral: 'III', nombre: 'Término medio', frecuencia: '1 de cada 2 candidatos', desde: 21 },
  { numeral: 'IV', nombre: 'Inferior al término medio', frecuencia: '1 de cada 3 candidatos', desde: 11 },
  { numeral: 'V', nombre: 'Deficiencia intelectual', frecuencia: '1 de cada 15 candidatos', desde: 0 },
];

/**
 * Cómo se escribe un rango. Es lo que queda guardado.
 *
 * Sin la frecuencia, que se muestra al lado y sale de {@link RANGOS}: adentro
 * del texto guardado quedaría congelada la del día que se cargó la medición, y
 * el día que se cambie por la de los casos propios habría que reescribir todas
 * las mediciones viejas para que no convivan dos.
 */
export function textoDelRango(r: Rango): string {
  return `Rango ${r.numeral} · ${r.nombre}`;
}

/** El rango de un puntaje directo. */
export function rangoDe(aciertos: number, rangos: Rango[] = RANGOS): Rango | null {
  return [...rangos].sort((a, b) => b.desde - a.desde).find((r) => aciertos >= r.desde) ?? null;
}

/** Entre qué puntajes cae cada rango, para dibujar la escala. */
export function puntajesPorRango(rangos: Rango[] = RANGOS): Map<string, { desde: number; hasta: number }> {
  const orden = [...rangos].sort((a, b) => b.desde - a.desde);
  const tramos = new Map<string, { desde: number; hasta: number }>();
  orden.forEach((r, i) => {
    tramos.set(r.numeral, { desde: r.desde, hasta: i === 0 ? RAVEN_MAXIMO : orden[i - 1].desde - 1 });
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

/**
 * Los rangos que rigen: los guardados si alguien los movió, y si no los de
 * fábrica.
 *
 * Se valida acá y no en la pantalla: un baremo mal guardado dejaría a cada
 * informe sin rango, y eso hay que atajarlo del lado que lo usa. Tienen que ser
 * cinco, con los cinco numerales, y ningún corte fuera de la escala.
 */
export function rangosValidos(guardados: unknown): Rango[] | null {
  if (!Array.isArray(guardados) || guardados.length !== RANGOS.length) return null;
  const salida: Rango[] = [];
  for (const base of RANGOS) {
    const suyo = guardados.find(
      (g) => g && typeof g === 'object' && (g as Rango).numeral === base.numeral
    ) as Rango | undefined;
    if (!suyo) return null;
    const desde = Number(suyo.desde);
    if (!Number.isInteger(desde) || desde < 0 || desde > RAVEN_MAXIMO) return null;
    salida.push({ ...base, desde, nombre: String(suyo.nombre ?? base.nombre) });
  }
  // Cada rango tiene que empezar más arriba que el de abajo: si dos se cruzan,
  // hay puntajes que caen en dos rangos y otros que no caen en ninguno.
  const orden = [...salida].sort((a, b) => b.desde - a.desde);
  for (let i = 1; i < orden.length; i++) {
    if (orden[i].desde >= orden[i - 1].desde) return null;
  }
  return salida;
}
