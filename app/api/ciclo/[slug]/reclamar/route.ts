import { NextResponse } from 'next/server';
import { getActividadPorClave, reclamarAporte, resolverCiclo } from '@/lib/ciclo';

/**
 * Reclamar el pozo de una pregunta.
 *
 * Solo lo toca quien la escribió, y cobrarlo es decir que fue suya: el nombre
 * pasa a verse proyectado al lado de su pregunta. Por eso es un toque aparte y
 * no algo que el sistema haga solo.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const ciclo = await resolverCiclo(params.slug);
  if (!ciclo) return new NextResponse('Ciclo no encontrado', { status: 404 });

  let datos: { asistenteId?: unknown; clave?: unknown };
  try {
    datos = await req.json();
  } catch {
    return new NextResponse('Datos ilegibles', { status: 400 });
  }

  const actividad = await getActividadPorClave(
    ciclo.corrida.ciclo_id,
    String(datos.clave ?? '')
  );
  if (!actividad) return new NextResponse('No existe esa consigna', { status: 404 });

  const ok = await reclamarAporte(actividad.id, String(datos.asistenteId ?? ''));
  if (!ok) return new NextResponse('No hay nada tuyo que reclamar', { status: 400 });

  return NextResponse.json({ ok: true });
}
