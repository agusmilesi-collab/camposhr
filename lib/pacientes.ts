/**
 * Las fichas de los pacientes del inquilino y su historia clínica.
 *
 * Solo entra y sale por la zona del inquilino, con su sesión, y nunca en modo
 * mirar. Ver `supabase/centro-pacientes.sql`.
 */
import 'server-only';
import { insert, patch, select } from '@/lib/supabase';

export type Paciente = {
  id: string;
  inquilino_id: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  fecha_nacimiento: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  cobertura: string | null;
  afiliado: string | null;
  contacto_emergencia: string | null;
  derivado_por: string | null;
  motivo_consulta: string | null;
  antecedentes: string | null;
  medicacion: string | null;
  alergias: string | null;
  notas: string | null;
  activo: boolean;
  /** El costo de la consulta, para la cuenta del paciente. */
  precio_consulta: number | null;
  created_at: string;
  updated_at: string;
};

export type Evolucion = {
  id: string;
  paciente_id: string;
  inquilino_id: string;
  fecha: string;
  texto: string;
  created_at: string;
  updated_at: string;
};

/** Lo que se puede escribir de una ficha, y nada más: lista blanca. */
export const CAMPOS_PACIENTE = [
  'nombre',
  'apellido',
  'dni',
  'fecha_nacimiento',
  'telefono',
  'correo',
  'direccion',
  'cobertura',
  'afiliado',
  'contacto_emergencia',
  'derivado_por',
  'motivo_consulta',
  'antecedentes',
  'medicacion',
  'alergias',
  'notas',
  'precio_consulta',
] as const;
export type CampoPaciente = (typeof CAMPOS_PACIENTE)[number];

const ID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNAS = `id,inquilino_id,${CAMPOS_PACIENTE.join(',')},activo,created_at,updated_at`;

export function nombreCompleto(p: Pick<Paciente, 'nombre' | 'apellido'>): string {
  return [p.apellido, p.nombre].filter((x) => x && x.trim()).join(', ');
}

/** Las fichas de la persona. Por defecto las activas; con `todos`, también
 *  las dadas de baja, que es lo que lista la pantalla de Pacientes. */
export async function pacientesDe(inquilinoId: string, todos = false): Promise<Paciente[]> {
  if (!ID_VALIDO.test(inquilinoId)) return [];
  return select<Paciente>(
    'centro_pacientes',
    `select=${COLUMNAS}&inquilino_id=eq.${inquilinoId}${todos ? '' : '&activo=eq.true'}&order=apellido.asc,nombre.asc`
  );
}

/** Una ficha, solo si es de esa persona. La de otro no existe para quien pregunta. */
export async function pacienteDe(inquilinoId: string, id: string): Promise<Paciente | null> {
  if (!ID_VALIDO.test(inquilinoId) || !ID_VALIDO.test(id)) return null;
  const filas = await select<Paciente>(
    'centro_pacientes',
    `select=${COLUMNAS}&inquilino_id=eq.${inquilinoId}&id=eq.${id}`
  );
  return filas[0] ?? null;
}

export async function crearPaciente(
  inquilinoId: string,
  datos: Partial<Record<CampoPaciente, string | null>> & { nombre: string }
): Promise<Paciente> {
  return insert<Paciente>('centro_pacientes', { inquilino_id: inquilinoId, ...datos });
}

export async function guardarPaciente(
  inquilinoId: string,
  id: string,
  datos: Partial<Record<CampoPaciente, string | null>> & { activo?: boolean }
): Promise<void> {
  if (!ID_VALIDO.test(inquilinoId) || !ID_VALIDO.test(id)) return;
  await patch('centro_pacientes', `id=eq.${id}&inquilino_id=eq.${inquilinoId}`, {
    ...datos,
    updated_at: new Date().toISOString(),
  });
}

export async function evolucionesDe(inquilinoId: string, pacienteId: string): Promise<Evolucion[]> {
  if (!ID_VALIDO.test(inquilinoId) || !ID_VALIDO.test(pacienteId)) return [];
  return select<Evolucion>(
    'centro_evoluciones',
    `select=id,paciente_id,inquilino_id,fecha,texto,created_at,updated_at` +
      `&inquilino_id=eq.${inquilinoId}&paciente_id=eq.${pacienteId}&order=fecha.desc,created_at.desc`
  );
}

export async function crearEvolucion(a: {
  inquilinoId: string;
  pacienteId: string;
  fecha: string;
  texto: string;
}): Promise<Evolucion> {
  return insert<Evolucion>('centro_evoluciones', {
    inquilino_id: a.inquilinoId,
    paciente_id: a.pacienteId,
    fecha: a.fecha,
    texto: a.texto,
  });
}

export async function guardarEvolucion(
  inquilinoId: string,
  id: string,
  datos: { fecha?: string; texto?: string }
): Promise<void> {
  if (!ID_VALIDO.test(inquilinoId) || !ID_VALIDO.test(id)) return;
  await patch('centro_evoluciones', `id=eq.${id}&inquilino_id=eq.${inquilinoId}`, {
    ...datos,
    updated_at: new Date().toISOString(),
  });
}

export async function borrarEvolucion(inquilinoId: string, id: string): Promise<void> {
  if (!ID_VALIDO.test(inquilinoId) || !ID_VALIDO.test(id)) return;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY as string;
  const res = await fetch(`${url}/rest/v1/centro_evoluciones?id=eq.${id}&inquilino_id=eq.${inquilinoId}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase delete centro_evoluciones ${res.status}: ${await res.text()}`);
}

/** Cuántas consultas tiene anotadas cada paciente, para la lista. */
export async function consultasPorPaciente(inquilinoId: string): Promise<Record<string, { cantidad: number; ultima: string }>> {
  if (!ID_VALIDO.test(inquilinoId)) return {};
  const filas = await select<{ paciente_id: string; fecha: string }>(
    'centro_evoluciones',
    `select=paciente_id,fecha&inquilino_id=eq.${inquilinoId}&order=fecha.desc`
  );
  const r: Record<string, { cantidad: number; ultima: string }> = {};
  for (const f of filas) {
    r[f.paciente_id] = r[f.paciente_id]
      ? { cantidad: r[f.paciente_id].cantidad + 1, ultima: r[f.paciente_id].ultima }
      : { cantidad: 1, ultima: f.fecha };
  }
  return r;
}
