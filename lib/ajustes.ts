import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';

/**
 * Lo que se puede mover desde Sistema, sin tocar el código.
 *
 * Tres cosas del motor son criterio clínico y no decisión técnica: dónde cortan
 * los rangos del Raven, cuánto pesa cada indicador dentro de su competencia y
 * qué dice cada lectura. El código trae el valor de fábrica y acá se lee la
 * diferencia, si alguien la guardó.
 *
 * **Una clave que no está significa "usá lo de fábrica"**, que no es lo mismo
 * que un valor vacío: volver atrás es borrar la clave, no dejarla en cero. Es la
 * misma forma que `evaluaciones.informe_listas`.
 *
 * Se lee del servidor y se cachea con el resto de psicotécnicos: cambia una vez
 * cada tanto y la lee cada informe que se abre.
 */

export type ClaveDeAjuste = 'raven_rangos' | 'competencias_pesos';

type Fila = { clave: string; valor: unknown };

/** Lo guardado para esa clave, o null si nadie la tocó. */
export async function ajuste<T>(clave: ClaveDeAjuste): Promise<T | null> {
  try {
    const filas = await select<Fila>(
      'ajustes',
      `select=clave,valor&clave=eq.${clave}&limit=1`,
      CACHE_PSICOTECNICOS
    );
    return (filas[0]?.valor as T) ?? null;
  } catch {
    // Un ajuste que no se puede leer no puede dejar sin informe a nadie: se
    // sigue con lo de fábrica, que es lo que estaba antes de que existiera esto.
    return null;
  }
}
