import { NextResponse } from 'next/server';
import { inquilinoQueEscribe } from '@/lib/centro-sesion';
import { borrarEvolucion, crearEvolucion, guardarEvolucion, pacienteDe } from '@/lib/pacientes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Una entrada de la historia clínica: fecha y texto. Se agrega, se edita y
 * se borra; el borrado es de la persona que la escribió, con su sesión.
 */
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mal(motivo: string, status = 400) {
  return NextResponse.json({ ok: false, motivo }, { status });
}

export async function POST(req: Request) {
  const sesion = await inquilinoQueEscribe();
  if ('error' in sesion) return mal(sesion.error.motivo, sesion.error.status);
  const datos = (await req.json().catch(() => null)) ?? {};
  const pacienteId = String(datos.pacienteId ?? '');
  const fecha = String(datos.fecha ?? '');
  const texto = String(datos.texto ?? '').trim().slice(0, 8000);
  if (!UUID.test(pacienteId)) return mal('Paciente inválido.');
  if (!FECHA.test(fecha)) return mal('Falta la fecha.');
  if (!texto) return mal('Escribí qué pasó en la consulta.');
  // La ficha tiene que ser de quien escribe.
  if (!(await pacienteDe(sesion.yo.id, pacienteId))) return mal('Ese paciente no existe.', 404);
  const e = await crearEvolucion({ inquilinoId: sesion.yo.id, pacienteId, fecha, texto });
  return NextResponse.json({ ok: true, id: e.id });
}

export async function PATCH(req: Request) {
  const sesion = await inquilinoQueEscribe();
  if ('error' in sesion) return mal(sesion.error.motivo, sesion.error.status);
  const datos = (await req.json().catch(() => null)) ?? {};
  const id = String(datos.id ?? '');
  if (!UUID.test(id)) return mal('Entrada inválida.');
  const cambios: { fecha?: string; texto?: string } = {};
  if ('fecha' in datos) {
    const f = String(datos.fecha ?? '');
    if (!FECHA.test(f)) return mal('Fecha inválida.');
    cambios.fecha = f;
  }
  if ('texto' in datos) {
    const t = String(datos.texto ?? '').trim().slice(0, 8000);
    if (!t) return mal('El texto no puede quedar vacío.');
    cambios.texto = t;
  }
  await guardarEvolucion(sesion.yo.id, id, cambios);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const sesion = await inquilinoQueEscribe();
  if ('error' in sesion) return mal(sesion.error.motivo, sesion.error.status);
  const datos = (await req.json().catch(() => null)) ?? {};
  const id = String(datos.id ?? '');
  if (!UUID.test(id)) return mal('Entrada inválida.');
  await borrarEvolucion(sesion.yo.id, id);
  return NextResponse.json({ ok: true });
}
