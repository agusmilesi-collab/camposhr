import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { RESPALDO, type BateriaDelPortal } from '@/lib/baterias';

/**
 * Las baterías como las ve el cliente, leídas de donde se editan.
 *
 * Va aparte de `lib/baterias.ts` porque eso lo importa el formulario del
 * portal, que corre en el navegador, y acá se lee de Supabase.
 *
 * Sin precios: el portal no los muestra, así que no se traen.
 */
export async function bateriasDelPortal(): Promise<BateriaDelPortal[]> {
  try {
    const filas = await select<{
      codigo: string;
      descripcion: string | null;
      para_quien: string | null;
      duracion_min: number | null;
    }>(
      'baterias',
      'select=codigo,descripcion,para_quien,duracion_min&order=codigo.asc',
      CACHE_PSICOTECNICOS
    );
    // Una batería sin sus dos textos no se puede ofrecer: el cliente elegiría a
    // ciegas. Si no queda ninguna, se muestra el respaldo.
    const listas = filas
      .filter((f) => f.descripcion && f.para_quien)
      .map((f) => ({
        codigo: f.codigo,
        queIncluye: f.descripcion as string,
        paraQuien: f.para_quien as string,
        minutos: f.duracion_min,
      }));
    return listas.length ? listas : RESPALDO;
  } catch {
    return RESPALDO;
  }
}
