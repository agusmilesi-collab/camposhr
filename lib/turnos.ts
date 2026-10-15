/**
 * Los turnos del inquilino: a quién atiende en cada hora reservada.
 *
 * Solo entra y sale por la zona del inquilino, con su sesión. El equipo del
 * Centro no lee esta tabla: a quién atiende cada profesional es de él.
 * Ver `supabase/centro-turnos.sql`.
 */
import 'server-only';
import { patch, select, upsert } from '@/lib/supabase';

export type Turno = {
  id: string;
  inquilino_id: string;
  fecha: string;
  /** "09:00:00", como lo devuelve la base. */
  desde_hora: string;
  paciente: string;
  nota: string | null;
  /** La ficha, cuando el nombre coincide con un paciente cargado. */
  paciente_id: string | null;
  /** Si vino: null hasta que se marca desde Inicio. */
  asistio: boolean | null;
  updated_at: string;
};

const ID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function turnosDe(inquilinoId: string, desde: string, hasta: string): Promise<Turno[]> {
  if (!ID_VALIDO.test(inquilinoId)) return [];
  return select<Turno>(
    'centro_turnos',
    `select=id,inquilino_id,fecha,desde_hora,paciente,nota,paciente_id,asistio,updated_at&inquilino_id=eq.${inquilinoId}` +
      `&fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha.asc,desde_hora.asc`
  );
}

/** Los nombres que ya usó, para completar al escribir. Sin repetir. */
export async function pacientesDe(inquilinoId: string): Promise<string[]> {
  if (!ID_VALIDO.test(inquilinoId)) return [];
  const filas = await select<{ paciente: string }>(
    'centro_turnos',
    `select=paciente&inquilino_id=eq.${inquilinoId}&order=updated_at.desc&limit=400`
  );
  return [...new Set(filas.map((f) => f.paciente.trim()))].sort((a, b) => a.localeCompare(b, 'es'));
}

export async function guardarTurno(a: {
  inquilinoId: string;
  fecha: string;
  hora: number;
  paciente: string;
  nota: string | null;
  pacienteId: string | null;
}): Promise<Turno> {
  return upsert<Turno>(
    'centro_turnos',
    {
      inquilino_id: a.inquilinoId,
      fecha: a.fecha,
      desde_hora: `${String(a.hora).padStart(2, '0')}:00:00`,
      paciente: a.paciente,
      nota: a.nota,
      paciente_id: a.pacienteId,
      updated_at: new Date().toISOString(),
    },
    'inquilino_id,fecha,desde_hora'
  );
}

/** Marca si el paciente vino, no vino, o vuelve a sin marcar. Solo sobre un
 *  turno propio: el filtro lleva el inquilino además del id. */
export async function marcarAsistencia(inquilinoId: string, id: string, asistio: boolean | null): Promise<void> {
  if (!ID_VALIDO.test(inquilinoId) || !ID_VALIDO.test(id)) return;
  await patch('centro_turnos', `id=eq.${id}&inquilino_id=eq.${inquilinoId}`, {
    asistio,
    updated_at: new Date().toISOString(),
  });
}

export async function borrarTurno(inquilinoId: string, fecha: string, hora: number): Promise<void> {
  if (!ID_VALIDO.test(inquilinoId)) return;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY as string;
  const desde = `${String(hora).padStart(2, '0')}:00:00`;
  const res = await fetch(
    `${url}/rest/v1/centro_turnos?inquilino_id=eq.${inquilinoId}&fecha=eq.${fecha}&desde_hora=eq.${desde}`,
    { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`Supabase delete centro_turnos ${res.status}: ${await res.text()}`);
}
