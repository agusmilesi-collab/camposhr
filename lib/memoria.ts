import 'server-only';

/**
 * Caché de lectura, en la memoria del proceso, para lo que no cambia mientras
 * dura un encuentro.
 *
 * Treinta teléfonos preguntando en la misma sala pedían treinta veces por
 * minuto la misma empresa y la misma lista de actividades, que son las mismas
 * desde que el ciclo se dio de alta. El 7 de agosto de 2026 esa repetición
 * saturó la base y la gente quedó trabada en la primera pregunta.
 *
 * Sólo entra acá lo que se puede servir viejo por unos segundos sin que nadie
 * lo note. Lo que cambia en el momento (qué actividad está abierta, quién
 * respondió) se pregunta siempre, porque un dato de hace un minuto ahí sería
 * un teléfono mostrando la consigna equivocada.
 */

type Guardado = { hasta: number; valor: unknown };

const CAJON = new Map<string, Guardado>();

/**
 * El valor guardado si todavía sirve, y si no, el que traiga `traer`.
 *
 * Cada instancia del servidor tiene la suya: no hay nada que invalidar ni que
 * mantener sincronizado, y lo peor que pasa es que una instancia sirva algo de
 * hace `segundos`.
 */
export async function recordar<T>(
  clave: string,
  segundos: number,
  traer: () => Promise<T>
): Promise<T> {
  const ahora = Date.now();
  const guardado = CAJON.get(clave);
  if (guardado && guardado.hasta > ahora) return guardado.valor as T;

  const valor = await traer();
  CAJON.set(clave, { hasta: ahora + segundos * 1000, valor });

  // El cajón no crece: son una empresa y un ciclo por encuentro, y las claves
  // vencidas de encuentros viejos se sacan al pasar.
  if (CAJON.size > 50) {
    for (const [k, v] of CAJON) if (v.hasta <= ahora) CAJON.delete(k);
  }
  return valor;
}
