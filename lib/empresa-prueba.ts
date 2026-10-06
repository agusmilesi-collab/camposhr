/**
 * La empresa inventada con la que se prueba: no es trabajo real.
 *
 * Vive suelta y sin `server-only` porque la miran los dos lados: el lector de
 * Airtable, para no contar sus evaluaciones como trabajo, y el portal, para
 * mostrarle el molde nuevo del informe mientras se termina de afinar. El resto
 * de las empresas sigue con el que ya conocen.
 */
export const EMPRESA_PRUEBA = /^distribuidora andina/i;

export function esEmpresaDePrueba(nombre: string | null | undefined): boolean {
  return Boolean(nombre && EMPRESA_PRUEBA.test(nombre.trim()));
}

/**
 * El informe en hojas, para todos los clientes.
 *
 * Hasta el 6/10/2026 el molde nuevo del informe (una carilla de conclusiones
 * y un capítulo por hoja) corría solo en la empresa de prueba, mientras se
 * afinaba. Ese día se liberó. Es un solo interruptor para los tres lugares
 * que lo miran: la pestaña Informe de la ficha, la descarga del OS y el portal
 * del cliente. Volver atrás es ponerlo en falso, y el molde vuelve a correr
 * solo en la empresa de prueba.
 */
export const INFORME_EN_HOJAS_PARA_TODOS = true;

/** Si a esta empresa le toca el informe en hojas. */
export function informeEnHojas(nombre: string | null | undefined): boolean {
  return INFORME_EN_HOJAS_PARA_TODOS || esEmpresaDePrueba(nombre);
}
