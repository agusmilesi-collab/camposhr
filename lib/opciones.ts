/**
 * El texto de las opciones de una actividad.
 *
 * Vive fuera de `lib/ciclo.ts` porque de ahí adelante todo es de servidor, y
 * esto lo necesitan las dos puntas: el teléfono del asistente y la consigna
 * que se proyecta.
 */

/**
 * Separa "Título · qué quiere decir".
 *
 * La aclaración viaja con la opción y se muestra debajo, más chica. Una opción
 * que hay que interpretar se responde distinto en cada cabeza, y ahí el dato
 * deja de servir para comparar.
 */
export function partirOpcion(opcion: string): [string, string | null] {
  const corte = opcion.indexOf(' · ');
  if (corte === -1) return [opcion, null];
  return [opcion.slice(0, corte), opcion.slice(corte + 3)];
}
