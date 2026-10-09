/**
 * Qué cuenta como una dirección de correo.
 *
 * Vive aparte de `lib/correo.ts` porque lo usan los dos lados: el servidor al
 * mandar, y la tarjeta de Entrevistas al decidir si al candidato le falta el
 * correo. Una dirección mal escrita es lo mismo que no tener ninguna: el aviso
 * no le llega.
 */
export const DIRECCION = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

export function esDireccion(x: string | null | undefined): boolean {
  return DIRECCION.test((x ?? '').trim());
}
