/**
 * Lo que pasa fuera del OS cuando una entrevista se agenda, se mueve o se cae:
 * el evento en el calendario de la evaluadora y el correo al candidato.
 *
 * Van en ese orden porque el correo lleva el enlace de la sala, y la sala la
 * crea el evento. Las dos miran cómo quedó la evaluación y ninguna tira, así
 * que se llama después de cualquier guardado que toque la fecha, la modalidad,
 * la etapa, la evaluadora o la baja.
 */

import 'server-only';
import { patch, select } from '@/lib/supabase';
import { agendadasDe, sincronizarCalendario } from '@/lib/google-calendario';
import { avisarAlCandidato } from '@/lib/correo-candidato';

export async function entrevistaAlDia(evaluacionId: string): Promise<void> {
  await sincronizarCalendario(evaluacionId);
  await avisarAlCandidato(evaluacionId);
}

/**
 * Recién conectado el calendario: entran las entrevistas que esa evaluadora ya
 * tenía agendadas para adelante.
 *
 * **A esos candidatos no se les escribe.** Ya coordinaron con ella cómo se
 * conectan, y un correo con otra sala les dejaría dos enlaces para la misma
 * entrevista. Se anotan como avisados para esa fecha; si después se
 * reprograma, el correo sale como con cualquier otra.
 */
export async function ponerAlDia(evaluadoraId: string): Promise<void> {
  try {
    for (const id of await agendadasDe(evaluadoraId)) {
      await sincronizarCalendario(id);
      const [e] = await select<{ fecha_entrevista: string | null; aviso_candidato_fecha: string | null }>(
        'evaluaciones',
        `select=fecha_entrevista,aviso_candidato_fecha&id=eq.${id}&limit=1`
      );
      if (e?.fecha_entrevista && !e.aviso_candidato_fecha) {
        await patch('evaluaciones', `id=eq.${id}`, { aviso_candidato_fecha: e.fecha_entrevista });
      }
    }
  } catch (err) {
    console.error('[google] no se pudieron traer las entrevistas ya agendadas', err);
  }
}
