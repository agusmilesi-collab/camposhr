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
 * Con qué cliente se arranca cuando nadie eligió todavía: con todos.
 *
 * Arrancaba con el cliente inventado, para que mientras se construía el sistema
 * la sección no se llenara de evaluaciones reales. Eso se dio vuelta en cuanto
 * entró el primer cliente de verdad: migrarlo y no encontrarlo en ninguna
 * pantalla se lee como que la migración falló, y en Sin asignar el filtro ni
 * siquiera se muestra, así que no hay nada que tocar para descubrir por qué.
 *
 * Un dato que existe y no aparece es peor que una lista larga.
 */
export const CLIENTE_POR_DEFECTO = TODAS;
