/**
 * Nombres de caché que se invalidan al escribir.
 *
 * Las pantallas del OS leen las mismas listas una y otra vez al moverse entre
 * etapas. Cachearlas hace que la navegación no vuelva a pedir todo; invalidar
 * por nombre en cuanto se guarda algo hace que ese ahorro no cueste ver un
 * dato viejo.
 */

export const CACHE_PSICOTECNICOS = 'psicotecnicos';
export const CACHE_COMERCIAL = 'comercial';
export const CACHE_CLIENTES = 'clientes';
