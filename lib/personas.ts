/**
 * Cómo se muestra el nombre de una persona.
 *
 * Las respuestas nuevas traen apellido y nombre por separado. Las anteriores
 * guardaron todo junto en `nombre` y quedan con `apellido` en null: no se
 * puede partir un nombre completo sin adivinar, así que se muestran tal cual.
 */
export type ConNombre = { apellido?: string | null; nombre: string };

/** "Pérez, Juan" cuando hay apellido; si no, lo que se haya cargado. */
export function nombreCompleto(p: ConNombre): string {
  const ape = (p.apellido ?? '').trim();
  return ape ? `${ape}, ${p.nombre}` : p.nombre;
}

/** Para ordenar alfabéticamente por apellido. */
export function claveOrden(p: ConNombre): string {
  return nombreCompleto(p).toLocaleLowerCase('es');
}
