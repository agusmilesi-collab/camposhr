import { NextResponse } from 'next/server';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import { hoyISO, mesCorrido, periodoDe } from '@/lib/consultorios';
import { responderRenovacion, type Respuesta } from '@/lib/renovaciones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El inquilino contesta si renueva sus horas para el mes que viene.
 *
 * El mes no viene del navegador: es siempre el que sigue al de hoy. Tampoco la
 * persona: es la de la cookie firmada.
 */
export async function POST(req: Request) {
  const yo = await inquilinoDeLaSesion();
  if (!yo) return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });

  const datos = await req.json().catch(() => null);
  const respuesta = String(datos?.respuesta ?? '') as Respuesta;
  if (!['si', 'no', 'cambiar'].includes(respuesta)) return mal('Respuesta inválida.');
  const nota = String(datos?.nota ?? '').trim().slice(0, 600) || null;
  if (respuesta === 'cambiar' && !nota) return mal('Contanos qué horas querés cambiar.');

  await responderRenovacion(yo.id, mesCorrido(periodoDe(hoyISO()), 1), respuesta, nota);
  return NextResponse.json({ ok: true });
}

function mal(motivo: string) {
  return NextResponse.json({ ok: false, motivo }, { status: 400 });
}
