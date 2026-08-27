import 'server-only';
import { select } from '@/lib/supabase';

/**
 * Lo pendiente del equipo: los temas de la próxima reunión y las tareas.
 *
 * Las dos cosas viven en `public.pendientes` y se distinguen por
 * `para_reunion` (ver `supabase/pendientes.sql`). Se leen juntas porque la home
 * muestra las dos y son pocas filas.
 *
 * **Un tema de reunión es solo un texto.** Responsable, estado y vencimiento
 * son de las tareas: un tema es del grupo hasta que se reparte, y repartirlo es
 * pasarlo a la otra lista.
 */

export {
  COLOR_ESTADO,
  ESTADOS,
  type Estado,
  type Pendiente,
} from '@/lib/pendientes-tipos';

import type { Pendiente } from '@/lib/pendientes-tipos';

const CAMPOS = 'id,texto,responsable,para_reunion,hecha,estado,vence,orden,created_at';

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
      // Lo que vence primero arriba, y lo que no tiene fecha detrás: una tarea
      // sin fecha no es más urgente que una que vence mañana.
      `select=${CAMPOS}&order=hecha.asc,vence.asc.nullslast,created_at.asc`
    );
    return {
      // Los temas van en el orden en que se piensa hablarlos, que se arrastra;
      // el que nadie movió queda al final, por antigüedad.
      reunion: filas
        .filter((f) => f.para_reunion)
        .sort(
          (a, b) =>
            (a.orden ?? Infinity) - (b.orden ?? Infinity) ||
            a.created_at.localeCompare(b.created_at)
        ),
      tareas: filas.filter((f) => !f.para_reunion),
    };
  } catch {
    // Media home sirve para trabajar y una home en blanco no.
    return { reunion: [], tareas: [] };
  }
}
