/**
 * Mediciones separadas en el tiempo.
 *
 * Macro Agro respondió dos veces con un año de diferencia (sep-nov 2024 y
 * oct-nov 2025). Mezclarlas falsea los porcentajes y hace que catorce
 * personas cuenten dos veces con datos distintos, así que cada respuesta
 * pertenece a la tanda del año en que se respondió.
 */

export type ConFecha = { created_at: string };

/** El año de la medición, que es lo que separa una tanda de otra. */
export function tandaDe(r: ConFecha): string {
  return r.created_at.slice(0, 4);
}

/** Las tandas presentes, de la más reciente a la más vieja. */
export function tandasDe(respuestas: ConFecha[]): string[] {
  return [...new Set(respuestas.map(tandaDe))].sort().reverse();
}

/**
 * Deja sólo la tanda pedida. Sin tanda válida se usa la más reciente, que es
 * la que interesa mirar por defecto.
 */
export function filtrarTanda<T extends ConFecha>(
  respuestas: T[],
  pedida?: string
): { tanda: string | null; filtradas: T[]; tandas: string[] } {
  const tandas = tandasDe(respuestas);
  if (tandas.length === 0) return { tanda: null, filtradas: [], tandas };

  const tanda = pedida && tandas.includes(pedida) ? pedida : tandas[0];
  return { tanda, filtradas: respuestas.filter((r) => tandaDe(r) === tanda), tandas };
}
