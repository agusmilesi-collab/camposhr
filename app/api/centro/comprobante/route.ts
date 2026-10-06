import { NextResponse } from 'next/server';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import { enlaceDelComprobante, guardarComprobante } from '@/lib/comprobantes-pago';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FECHA = /^\d{4}-\d{2}-01$/;

/**
 * El inquilino sube el comprobante de su transferencia.
 *
 * Queda a nombre de la persona de la cookie firmada, nunca de un identificador
 * que venga del navegador. No registra ningún pago: eso lo hace el equipo.
 */
export async function POST(req: Request) {
  const yo = await inquilinoDeLaSesion();
  if (!yo) return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });

  const datos = await req.formData().catch(() => null);
  const archivo = datos?.get('archivo');
  const periodo = String(datos?.get('periodo') ?? '');
  if (!(archivo instanceof File)) return mal('Falta el archivo.');
  if (!FECHA.test(periodo)) return mal('Falta el mes que se paga.');

  const r = await guardarComprobante(yo.id, periodo, archivo);
  if (!r.ok) return mal(r.motivo);
  return NextResponse.json({ ok: true });
}

/** Abre uno propio. El de otro no existe para quien pregunta. */
export async function GET(req: Request) {
  const yo = await inquilinoDeLaSesion();
  if (!yo) return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const enlace = await enlaceDelComprobante(id, yo.id);
  if (!enlace) return NextResponse.json({ ok: false, motivo: 'Ese comprobante no existe.' }, { status: 404 });
  return NextResponse.redirect(enlace, 302);
}

function mal(motivo: string) {
  return NextResponse.json({ ok: false, motivo }, { status: 400 });
}
