/**
 * Psicotécnicos, con los dos orígenes detrás.
 *
 * Es la capa de servicios del spec de arquitectura aplicada a este servicio:
 * la pantalla pide "las evaluaciones" y no sabe si esa persona vive en
 * Airtable o en Supabase. Cada fila trae su origen, y un guardado va al lado
 * donde vive.
 *
 * **La dirección de la migración es una sola.** Lo nuevo se carga en
 * Supabase; lo que quede en Airtable se muda cuando le toque. El día que
 * Airtable esté vacío, se borra `lib/psicotecnicos-airtable.ts` y este
 * archivo pierde media docena de líneas.
 */

import 'server-only';
import * as airtable from '@/lib/psicotecnicos-airtable';
import * as supabase from '@/lib/psicotecnicos-supabase';
import type { Evaluacion, Origen } from '@/lib/psicotecnicos-tipos';

export type { Evaluacion, Origen };
export {
  ETAPAS,
  ETAPA_DE_RUTA,
  RUTA,
  puedeEscribir,
  type CampoEditable,
  type Etapa,
} from '@/lib/psicotecnicos-airtable';

/**
 * Las evaluaciones que el OS muestra. Solo las de Supabase.
 *
 * Las que todavía viven en Airtable quedan afuera de la pantalla a propósito.
 * El OS no las puede modificar (ver `guardarCampos` más abajo y `CLAUDE.md`),
 * así que mostrarlas solo sirve para intentar moverlas y chocar contra el
 * aviso. Mientras dura la migración se trabaja con lo que está en Supabase:
 * Distribuidora Andina y sus candidatos falsos.
 *
 * **Esto se saca cuando la migración termine.** El día que la tabla Individuo
 * esté en Supabase, `airtable.listar()` no tiene nada que aportar y el import
 * de `psicotecnicos-airtable` se va con él.
 */
export async function listarEvaluaciones(): Promise<{
  filas: Evaluacion[];
  fallaron: Origen[];
}> {
  try {
    return { filas: await supabase.listar(), fallaron: [] };
  } catch {
    return { filas: [], fallaron: ['supabase'] };
  }
}

/** Las evaluadoras de los dos lados, sin repetir. */
export async function listarEvaluadoras(): Promise<string[]> {
  const listas = await Promise.allSettled([airtable.evaluadoras(), supabase.evaluadoras()]);
  const nombres = new Set<string>();
  for (const l of listas) {
    if (l.status === 'fulfilled') l.value.forEach((n) => nombres.add(n));
  }
  return [...nombres].sort((a, b) => a.localeCompare(b));
}

/**
 * Guarda uno o varios campos. Siempre en Supabase.
 *
 * Varios a la vez y no de a uno porque hay cambios que son uno solo: asignar
 * una evaluadora es ponerle la evaluadora y sacarla de "Sin asignar", y si eso
 * viajara en dos pedidos podría quedar hecho a medias.
 */
/**
 * Qué campos puede guardar una pantalla.
 *
 * La lista sale de Supabase y no de Airtable: es donde se escribe, y un campo
 * que existe allá pero no acá no se puede guardar en ningún lado.
 */
export { esCampoEditable } from '@/lib/psicotecnicos-supabase';

export async function guardarCampos(
  id: string,
  cambios: Partial<Record<airtable.CampoEditable, string | boolean | null>>
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  // El OS no escribe en Airtable. Una ficha del lado viejo se migra a Supabase
  // antes de que una pantalla pueda modificarla; guardarla acá dejaría el dato
  // verdadero repartido en dos lugares que se contradicen. Ver `CLAUDE.md`.
  if (!supabase.esDeSupabase(id)) {
    return {
      ok: false,
      motivo:
        'Esta ficha todavía vive en Airtable y el OS no escribe ahí. Hay que migrarla a Supabase para poder moverla.',
    };
  }

  return supabase.guardarCampos(
    id,
    cambios as Record<string, string | boolean | null>
  );
}
