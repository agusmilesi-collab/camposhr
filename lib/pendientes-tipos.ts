/**
 * La forma de un pendiente del equipo, sin nada del servidor.
 *
 * Vive aparte de `lib/pendientes.ts` porque ese archivo lleva `server-only` y
 * el panel de la home es un componente de cliente: importar de allá rompe el
 * build entero. Es la misma razón por la que existen `lib/comercial-tipos.ts`
 * y `lib/clientes-tipos.ts` (ver `CLAUDE.md`).
 */

/**
 * En qué anda una tarea del equipo.
 *
 * Tres y no dos porque "no está hecha" no distingue lo que nadie empezó de lo
 * que alguien ya tiene entre manos, y en la reunión las dos se volvían a
 * repartir. `hecha` sale de acá y no se edita aparte.
 */
export const ESTADOS = ['Pendiente', 'En curso', 'Hecha'] as const;

export type Estado = (typeof ESTADOS)[number];

/**
 * Vencida se muestra pero no se guarda: la dice la fecha.
 *
 * Guardarla obligaría a escribir en la base todas las noches para que una
 * tarea amanezca vencida, y dejaría de ser cierta en cuanto alguien corriera
 * la fecha. Es la misma decisión que la prioridad del tablero de psicotécnicos:
 * lo que depende del calendario se calcula al mirarlo.
 *
 * Debajo sigue estando el estado real, que es el que se elige y el que se
 * guarda: una vencida sigue siendo Pendiente o En curso, y vuelve a decirlo
 * sola en cuanto se le corre la fecha.
 */
export const VENCIDA = 'Vencida';

export type EstadoVisible = Estado | typeof VENCIDA;

export const COLOR_ESTADO: Record<EstadoVisible, string> = {
  Pendiente: 'os-gris',
  'En curso': 'os-ambar',
  Hecha: 'os-verde',
  [VENCIDA]: 'os-rojo',
};

export type Pendiente = {
  id: string;
  texto: string;
  responsable: string | null;
  para_reunion: boolean;
  hecha: boolean;
  /** Pendiente, En curso o Hecha. Los temas de reunión no lo usan. */
  estado: Estado;
  /** Cuándo deja de poder esperar. Null es "sin fecha". */
  vence: string | null;
  created_at: string;
};

/**
 * Si la fecha ya pasó y la tarea sigue sin terminarse.
 *
 * No es un estado más: la tarea sigue siendo la que era, pendiente o en curso,
 * y lo que cambia es que ahora reclama. Por eso se calcula al mirarla en vez
 * de guardarse: guardarla obligaría a escribir en la base todas las noches
 * para que una tarea amanezca vencida, y dejaría de ser cierta en cuanto
 * alguien corriera la fecha.
 *
 * Una hecha no vence: se entregó, y que la fecha haya pasado es historia y no
 * un reclamo. Una sin fecha tampoco: nadie le puso plazo.
 *
 * El día de hoy lo trae el servidor (`hoy()` de `lib/hora`), porque calculado
 * en el navegador depende del huso de quien mira y la primera pintura no
 * coincidiría con la que llega del servidor.
 */
export function estaVencida(
  p: Pick<Pendiente, 'estado' | 'vence'>,
  hoy: string
): boolean {
  return p.estado !== 'Hecha' && Boolean(p.vence) && (p.vence as string) < hoy;
}

/** Lo que dice el sello: Vencida si la fecha pasó, y si no el estado guardado. */
export function estadoVisible(
  p: Pick<Pendiente, 'estado' | 'vence'>,
  hoy: string
): EstadoVisible {
  return estaVencida(p, hoy) ? VENCIDA : p.estado;
}
