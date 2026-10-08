import 'server-only';
import { patch, select, upsert } from '@/lib/supabase';

/**
 * La renovación de las horas para el mes siguiente.
 *
 * Desde el 25, el inicio del inquilino le pregunta si sigue con sus horas el
 * mes que viene. Acá se guarda lo que contestó y se le avisa al equipo cuando
 * la respuesta pide hacer algo. Ver `supabase/renovaciones.sql`.
 */

/** Desde qué día del mes se pregunta por el mes siguiente. */
export const DIA_DE_RENOVAR = 25;

export type Respuesta = 'si' | 'no' | 'cambiar';

export type Renovacion = {
  id: string;
  inquilino_id: string;
  periodo: string;
  respuesta: Respuesta;
  nota: string | null;
  /** Los feriados de ese mes en los que igual quiere usar su sala. */
  feriados: string[];
  respondido_at: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function renovacionDe(inquilinoId: string, periodo: string): Promise<Renovacion | null> {
  const filas = await select<Renovacion>(
    'renovaciones',
    `select=id,inquilino_id,periodo,respuesta,nota,feriados,respondido_at&inquilino_id=eq.${inquilinoId}&periodo=eq.${periodo}&limit=1`
  );
  return filas[0] ?? null;
}

/** Guarda la respuesta. Contestar de nuevo pisa la anterior y vuelve a avisar. */
export async function responderRenovacion(
  inquilinoId: string,
  periodo: string,
  respuesta: Respuesta,
  nota: string | null,
  feriados: string[] = []
): Promise<void> {
  await upsert(
    'renovaciones',
    {
      inquilino_id: inquilinoId,
      periodo,
      respuesta,
      nota: respuesta === 'cambiar' ? nota : null,
      // Quien no sigue no usa ningún feriado.
      feriados: respuesta === 'no' ? [] : feriados,
      respondido_at: new Date().toISOString(),
      visto_at: null,
    },
    'inquilino_id,periodo',
    false
  );
}

/**
 * Las respuestas que le piden algo al equipo y nadie atendió todavía.
 *
 * Un "sí" a secas no entra: es lo que se esperaba y no hay nada que hacer. Un
 * "no" deja horas para vender, un "cambiar" pide mover bandas, y un "sí" con
 * un feriado tildado pide reservarle la sala un día en que el Centro cierra.
 */
export async function renovacionesPorAtender(): Promise<(Renovacion & { inquilino: string })[]> {
  const filas = await select<Renovacion & { inquilinos: { nombre: string } | null }>(
    'renovaciones',
    'select=id,inquilino_id,periodo,respuesta,nota,feriados,respondido_at,inquilinos(nombre)' +
      '&or=(respuesta.in.(no,cambiar),feriados.neq.{})&visto_at=is.null&order=respondido_at.asc'
  );
  return filas.map(({ inquilinos, ...r }) => ({ ...r, inquilino: inquilinos?.nombre ?? 'Sin nombre' }));
}

export async function darPorVista(id: string): Promise<void> {
  if (!UUID.test(id)) return;
  await patch('renovaciones', `id=eq.${id}`, { visto_at: new Date().toISOString() });
}
