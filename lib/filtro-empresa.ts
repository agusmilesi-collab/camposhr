/**
 * El filtro por cliente de la sección de psicotécnicos.
 *
 * Vive en su propio módulo, sin 'use client' ni 'server-only', porque lo
 * necesitan las dos mitades: el selector lo escribe en el navegador y la
 * pantalla lo lee en el servidor.
 *
 * No puede vivir en el componente: del lado del servidor, lo que se importa de
 * un módulo 'use client' no es el valor sino una referencia al cliente, así que
 * la constante llega vacía y el filtro se comporta como si nadie hubiera
 * elegido nada.
 */

export const COOKIE_EMPRESA = 'os_empresa';

/** Lo que se guarda cuando se eligen todas: distinto de no haber elegido nada. */
export const TODAS = '__todas';

/**
 * Con qué cliente se arranca cuando nadie eligió todavía.
 *
 * Es el cliente inventado. Mientras se construye el sistema, abrir la sección
 * y encontrarse con setenta y cinco evaluaciones de clientes reales estorba más
 * de lo que sirve; el filtro está a la vista y se saca con un clic.
 */
export const CLIENTE_POR_DEFECTO = 'Distribuidora Andina';
