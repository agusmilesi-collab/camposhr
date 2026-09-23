import { NextResponse } from 'next/server';
import { resolverCiclo, revelarSiguiente } from '@/lib/ciclo';

/**
 * Revela la pregunta siguiente del ranking. Lo tocan las expositoras desde la
 * placa proyectada, con el mouse de la compu que proyecta.
 *
 * Va sin clave a propósito: el botón vive en la placa, que es pública. Por eso
 * solo avanza de a un paso y nunca vuelve atrás (ver `revelarSiguiente`).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const ciclo = await resolverCiclo(params.slug, true);
  if (!ciclo) return new NextResponse('Ciclo no encontrado', { status: 404 });

  let desde = -1;
  try {
    desde = Number((await req.json())?.desde);
  } catch {
    return new NextResponse('Datos ilegibles', { status: 400 });
  }

  await revelarSiguiente(ciclo.corrida.id, desde);
  return NextResponse.json({ ok: true });
}
