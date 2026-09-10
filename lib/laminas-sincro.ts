/**
 * Las dos pantallas de la administración, moviéndose juntas.
 *
 * En la primera instancia la evaluadora comparte por videollamada **la pestaña**
 * de las láminas, no su pantalla: Chrome sigue mostrando esa pestaña del otro
 * lado aunque ella pase a otra ventana, así que puede tener adelante la pantalla
 * de codificación y escribir lo que el candidato dice sin que él lo vea.
 *
 * Lo que falta con eso es que pasar de lámina de un lado la cambie del otro, y
 * de eso se encarga este canal. Va por `BroadcastChannel`, que llega a todas las
 * pestañas del mismo navegador y del mismo origen sin pasar por el servidor: es
 * la misma persona en la misma máquina, y una vuelta a la red por cada cambio de
 * lámina se notaría del otro lado.
 *
 * No sirve para dos máquinas distintas, que es lo correcto acá: las dos
 * pantallas son de la evaluadora.
 */

export const CANAL = 'campos-laminas';

/**
 * Qué lámina hay que mostrar, quién lo pide y de qué evaluación es.
 *
 * La evaluación va en el aviso porque el canal llega a todas las pestañas del
 * navegador: con dos candidatos abiertos a la vez, pasar de lámina en uno le
 * cambiaba la lámina al otro, y del otro lado hay alguien mirando una mancha
 * que no es la que le toca. Pasa con dos evaluadoras compartiendo una máquina
 * y también con una sola que deja dos fichas abiertas.
 */
export type Aviso = {
  lamina: number;
  de: 'laminas' | 'codificacion';
  /** Nulo en la pantalla de láminas abierta suelta, que sigue a cualquiera. */
  evaluacion?: string | null;
  /**
   * Una pregunta, o su respuesta.
   *
   * `'donde'` lo manda la pantalla de codificación; `'aca'` lo contesta la de
   * las láminas con la que está mostrando. Sirve para lo que antes no se podía
   * saber desde la de codificación: si esa pantalla sigue abierta y si está en
   * la lámina que corresponde.
   *
   * **Pregunta la de codificación y no al revés** porque es la que está al
   * frente. Chrome frena los relojes de las pestañas que quedan atrás, y la de
   * las láminas está atrás casi todo el tiempo: latiendo sola, a los cinco
   * minutos pasa a hacerlo una vez por minuto y desde acá se vería como si se
   * hubiera cerrado. Contestar, en cambio, lo dispara el mensaje que llega.
   */
  pulso?: 'donde' | 'aca';
};

/** Cada cuánto se pregunta, y cuánto se espera la respuesta. */
export const PULSO_MS = 1500;
export const SIN_RESPUESTA_MS = 4000;

/**
 * Cuánto tiene que durar un desfase para avisarlo.
 *
 * Entre que una pantalla cambia de lámina y la otra la sigue pasa un momento en
 * que están en distinta: la imagen de la lámina nueva pesa dos megas y hay que
 * bajarla antes de mostrarla. Avisar de eso en cada cambio enseña a ignorar el
 * aviso, que es lo peor que le puede pasar.
 */
export const DESFASE_MS = 2500;

/** Si un aviso es para esta pantalla. Sin evaluación, escucha a cualquiera. */
export function esParaMi(aviso: Aviso, mia: string | null): boolean {
  if (!mia || !aviso.evaluacion) return true;
  return aviso.evaluacion === mia;
}

/** Abre el canal, o devuelve null donde no exista (render del servidor). */
export function abrirCanal(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(CANAL);
}
