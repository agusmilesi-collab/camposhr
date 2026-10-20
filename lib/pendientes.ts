import 'server-only';
import { select, patch } from '@/lib/supabase';
import { hoyIso } from '@/lib/hora';

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

const CAMPOS = 'id,texto,responsable,para_reunion,hecha,estado,vence,orden,repite_dia,created_at';

/** El último día `dia` de la semana que no pasa de `hoy`, como "2026-10-22". */
function ultimoDia(hoy: string, dia: number): string {
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - dia + 7) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Una tarea semanal, como se la ve hoy. Null si todavía no le toca.
 *
 * Pendiente, está escondida hasta su `vence`: aparece ese día y queda a la
 * vista hasta que la marquen hecha, vencida si pasa de largo. Hecha, el mismo
 * día de la semana siguiente vuelve a Pendiente con `vence` en ese día, y eso
 * se escribe en la base: si fuera solo de lectura, cambiarle el estado o el
 * responsable la dejaría con el vencimiento viejo. La que no se repite pasa
 * igual.
 */
async function alDia(p: Pendiente, hoy: string): Promise<Pendiente | null> {
  if (p.repite_dia === null || p.para_reunion) return p;
  if (!p.hecha) return p.vence && p.vence > hoy ? null : p;
  const vuelve = ultimoDia(hoy, p.repite_dia);
  if (!p.vence || vuelve <= p.vence) return p;
  const reabierta = { ...p, hecha: false, estado: 'Pendiente' as const, vence: vuelve };
  try {
    await patch('pendientes', `id=eq.${p.id}`, {
      hecha: false,
      estado: 'Pendiente',
      vence: vuelve,
      actualizado_at: new Date().toISOString(),
    });
  } catch {
    // Si no se pudo escribir se muestra igual reabierta: la próxima lectura lo
    // vuelve a intentar.
  }
  return reabierta;
}

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
      tareas: (
        await Promise.all(filas.filter((f) => !f.para_reunion).map((f) => alDia(f, hoyIso())))
      ).filter((f): f is Pendiente => f !== null),
    };
  } catch {
    // Media home sirve para trabajar y una home en blanco no.
    return { reunion: [], tareas: [] };
  }
}
