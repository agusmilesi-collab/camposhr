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

/** Los días en que puede quedar el compromiso. Sábado y domingo no trabajan. */
export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

/**
 * El tramo de una escala de 1 a 10, con los cortes de la recomendación neta.
 *
 * 9 y 10 en verde, 7 y 8 en ámbar, 6 para abajo en rojo. El color va en los dos
 * lados: en el botón que se toca y en la barra del resumen, para que la
 * expositora lea la distribución sin contar.
 */
export function tramo(n: number): 'es-verde' | 'es-ambar' | 'es-rojo' {
  if (n >= 9) return 'es-verde';
  if (n >= 7) return 'es-ambar';
  return 'es-rojo';
}
