import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import type { Exigencia } from '@/lib/exigencia';

/**
 * Los perfiles de exigencia guardados, la predeterminada primero.
 *
 * Si la consulta falla se devuelve una lista vacía y quien la pide se queda con
 * la de fábrica: un problema para leer esta tabla no puede dejar sin informe a
 * nadie, porque lo único que aporta es cómo se nombra un puntaje.
 */
export async function exigenciasGuardadas(): Promise<Exigencia[]> {
  try {
    return await select<Exigencia>(
      'exigencias',
      'select=id,nombre,sobresaliente,alto,adecuado,predeterminada,notas' +
        '&order=predeterminada.desc,nombre.asc',
      CACHE_PSICOTECNICOS
    );
  } catch {
    return [];
  }
}
