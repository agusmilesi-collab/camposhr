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
