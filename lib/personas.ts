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

/** Compara dos personas por apellido, y por nombre si comparten apellido. */
export function porApellido(a: ConNombre, b: ConNombre): number {
  return claveOrden(a).localeCompare(claveOrden(b), 'es');
}

/**
 * Apellido de un nombre escrito todo junto ("Maria Laura Rondot" -> "Rondot").
 *
 * Los líderes se cargan con el nombre completo en un solo campo, así que para
 * ordenarlos por apellido hay que deducirlo. Se toma la última palabra, más
 * las partículas que la acompañen ("Pilar del Fante" -> "del Fante").
 */
const PARTICULAS = new Set([
  'de', 'del', 'la', 'las', 'los', 'di', 'da', 'do', 'dos',
  'le', 'lo', 'van', 'von', 'mac', 'mc', 'san', 'santa',
]);

const sinTildes = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function apellidoDe(completo: string): string {
  const p = completo.trim().split(/\s+/);
  if (p.length <= 1) return completo.trim();
  let corte = p.length - 1;
  while (corte > 1 && PARTICULAS.has(sinTildes(p[corte - 1]))) corte--;
  return p.slice(corte).join(' ');
}

/** Compara dos nombres completos por su apellido. */
export function porApellidoSuelto(a: string, b: string): number {
  const clave = (n: string) => `${apellidoDe(n)} ${n}`.toLocaleLowerCase('es');
  return clave(a).localeCompare(clave(b), 'es');
}
