import 'server-only';
import { select } from '@/lib/supabase';

/**
 * Lo pendiente del equipo: los temas de la próxima reunión y las tareas.
 *
 * Las dos cosas viven en `public.pendientes` y se distinguen por
 * `para_reunion` (ver `supabase/pendientes.sql`). Se leen juntas porque la home
 * muestra las dos y son pocas filas.
 */

export type Pendiente = {
  id: string;
  texto: string;
  responsable: string | null;
  para_reunion: boolean;
  hecha: boolean;
  created_at: string;
};

const CAMPOS = 'id,texto,responsable,para_reunion,hecha,created_at';

/**
 * Lo abierto, más lo que se cerró hace poco.
 *
 * Lo hecho se sigue mostrando un rato para poder desmarcarlo si se tildó sin
 * querer, y para que en la reunión se vea qué se cerró desde la anterior.
 */
export async function pendientes(): Promise<{ reunion: Pendiente[]; tareas: Pendiente[] }> {
  try {
    const filas = await select<Pendiente>(
      'pendientes',
      `select=${CAMPOS}&order=hecha.asc,created_at.asc`
    );
    return {
      reunion: filas.filter((f) => f.para_reunion),
      tareas: filas.filter((f) => !f.para_reunion),
    };
  } catch {
    // Media home sirve para trabajar y una home en blanco no.
    return { reunion: [], tareas: [] };
  }
}
