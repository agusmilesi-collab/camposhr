/**
 * Psicotécnicos: la capa de servicios que leen las pantallas.
 *
 * Las evaluaciones viven en Supabase. Airtable quedó migrado el 15/9/2026 y el
 * OS ya no lo lee.
 */

import 'server-only';
import { esEmpresaEjemplo } from '@/lib/portal-ejemplo';
import * as supabase from '@/lib/psicotecnicos-supabase';
import type { Evaluacion, Origen } from '@/lib/psicotecnicos-tipos';

export type { Evaluacion, Origen };
export { ETAPAS, ETAPA_DE_RUTA, RUTA, type Etapa } from '@/lib/psicotecnicos-tipos';

/** Las evaluaciones que el OS muestra. */
export async function listarEvaluaciones(): Promise<{
  filas: Evaluacion[];
  fallaron: Origen[];
}> {
  try {
    // La empresa de la muestra queda afuera: es la que se le enseña a un
    // cliente desde la página de precios, y sus candidatos inventados aparecían
    // en el tablero del equipo con una entrevista agendada que nadie va a
    // tomar. Su portal la sigue viendo entera.
    const filas = (await supabase.listar()).filter((f) => !esEmpresaEjemplo(f.empresa));
    return { filas, fallaron: [] };
  } catch {
    return { filas: [], fallaron: ['supabase'] };
  }
}

/** Las evaluadoras, por nombre. */
export async function listarEvaluadoras(): Promise<string[]> {
  return (await supabase.evaluadoras()).sort((a, b) => a.localeCompare(b));
}

/**
 * Qué campos puede guardar una pantalla.
 *
 * Es una lista blanca: un campo que no está ahí no se puede tocar desde el OS
 * aunque alguien arme el pedido a mano.
 */
export { esCampoEditable } from '@/lib/psicotecnicos-supabase';

/**
 * Guarda uno o varios campos.
 *
 * Varios a la vez y no de a uno porque hay cambios que son uno solo: asignar
 * una evaluadora es ponerle la evaluadora y sacarla de "Sin asignar", y si eso
 * viajara en dos pedidos podría quedar hecho a medias.
 */
export async function guardarCampos(
  id: string,
  cambios: Record<string, string | boolean | null>
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!supabase.esDeSupabase(id)) {
    return { ok: false, motivo: 'Evaluación inválida.' };
  }
  return supabase.guardarCampos(id, cambios);
}
