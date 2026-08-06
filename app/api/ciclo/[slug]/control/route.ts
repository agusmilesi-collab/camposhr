import { NextResponse } from 'next/server';
import {
  abrirActividad,
  cerrarActividades,
  claveControlOk,
  resolverCiclo,
} from '@/lib/ciclo';

/**
 * Abrir y cerrar la actividad. Lo único que la expositora toca durante la charla.
 *
 * Va con clave: ver `claveControlOk` en lib/ciclo.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const ciclo = await resolverCiclo(params.slug);
  if (!ciclo) return new NextResponse('Ciclo no encontrado', { status: 404 });
  const { corrida } = ciclo;

  let datos: { accion?: unknown; actividadId?: unknown; clave?: unknown };
  try {
    datos = await req.json();
  } catch {
    return new NextResponse('Datos ilegibles', { status: 400 });
  }

  if (!claveControlOk(corrida, typeof datos.clave === 'string' ? datos.clave : null)) {
    return new NextResponse('No autorizado', { status: 403 });
  }

  try {
    if (datos.accion === 'cerrar') {
      await cerrarActividades(corrida.id);
    } else if (datos.accion === 'abrir') {
      await abrirActividad(corrida.id, String(datos.actividadId ?? ''));
    } else {
      return new NextResponse('Acción inválida', { status: 400 });
    }
  } catch {
    return new NextResponse('No se pudo cambiar la actividad', { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
