import { NextResponse } from 'next/server';
import { inquilinoQueEscribe } from '@/lib/centro-sesion';
import { CAMPOS_PACIENTE, crearPaciente, guardarPaciente, type CampoPaciente } from '@/lib/pacientes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Alta y edición de la ficha de un paciente. Solo la persona misma, con su
 * sesión: en modo mirar desde el OS no se escribe ni se lee.
 *
 * Los campos entran por lista blanca (`CAMPOS_PACIENTE`), recortados; lo
 * demás se descarta sin avisar.
 */
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mal(motivo: string, status = 400) {
  return NextResponse.json({ ok: false, motivo }, { status });
}

function limpiar(datos: Record<string, unknown>): Partial<Record<CampoPaciente, string | null>> {
  const r: Partial<Record<CampoPaciente, string | null>> = {};
  for (const c of CAMPOS_PACIENTE) {
    if (!(c in datos)) continue;
    const v = String(datos[c] ?? '').trim();
    r[c] = v ? v.slice(0, c === 'antecedentes' || c === 'medicacion' || c === 'notas' || c === 'motivo_consulta' ? 4000 : 200) : null;
  }
  if (r.fecha_nacimiento && !FECHA.test(r.fecha_nacimiento)) delete r.fecha_nacimiento;
  return r;
}

export async function POST(req: Request) {
  const sesion = await inquilinoQueEscribe();
  if ('error' in sesion) return mal(sesion.error.motivo, sesion.error.status);
  const datos = (await req.json().catch(() => null)) ?? {};
  const limpio = limpiar(datos);
  if (!limpio.nombre) return mal('Falta el nombre.');
  const paciente = await crearPaciente(sesion.yo.id, { ...limpio, nombre: limpio.nombre, apellido: limpio.apellido ?? '' });
  return NextResponse.json({ ok: true, id: paciente.id });
}

export async function PATCH(req: Request) {
  const sesion = await inquilinoQueEscribe();
  if ('error' in sesion) return mal(sesion.error.motivo, sesion.error.status);
  const datos = (await req.json().catch(() => null)) ?? {};
  const id = String(datos.id ?? '');
  if (!UUID.test(id)) return mal('Paciente inválido.');
  const limpio = limpiar(datos);
  if ('nombre' in limpio && !limpio.nombre) return mal('El nombre no puede quedar vacío.');
  if ('apellido' in limpio && limpio.apellido === null) limpio.apellido = '';
  await guardarPaciente(sesion.yo.id, id, limpio);
  return NextResponse.json({ ok: true });
}
