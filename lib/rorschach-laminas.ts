/**
 * Las diez láminas en orden, y cuáles se pueden codificar en la pantalla.
 *
 * Vive acá y no en el capturador porque lo necesitan los dos lados: el
 * componente de cliente para saber a cuál pasar, y la página del servidor para
 * decidir cuál abrir. Importar una constante desde un archivo con `use client`
 * rompe en tiempo de ejecución, que es la misma razón por la que existen
 * `lib/pendientes-tipos.ts` y `lib/clientes-tipos.ts`.
 *
 * Una lámina está **cargada** cuando tiene su Tabla A transcripta
 * (`rorschach-tabla-a.ts`) y sus áreas dibujadas (`rorschach-areas.ts`). Las
 * que no, se codifican a mano en la ficha.
 */

export const ORDEN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export const CARGADAS = ['I', 'II'];

/** La que sigue en el protocolo, que se toma en orden y no se vuelve. */
export function siguienteDe(lamina: string): string | null {
  const i = ORDEN.indexOf(lamina);
  return i >= 0 && i + 1 < ORDEN.length ? ORDEN[i + 1] : null;
}
