import { NextResponse } from 'next/server';
import { eventoDelPlan } from '@/lib/agenda';
import { getActividad, getAporteDe, resolverCiclo } from '@/lib/ciclo';

/**
 * El evento del compromiso, para que el calendario lo agende.
 *
 * Se arma con lo que la persona ya guardó, así que no viaja nada en la
 * dirección salvo quién es y de qué actividad se trata. El archivo se descarga
 * desde el servidor y no desde el navegador: en iPhone es la vía que abre la
 * pantalla de "Agregar al calendario" sin pasos intermedios.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const ciclo = await resolverCiclo(params.slug);
  if (!ciclo) return new NextResponse('Ciclo no encontrado', { status: 404 });

  const url = new URL(req.url);
  const actividadId = url.searchParams.get('actividad') ?? '';
  const asistenteId = url.searchParams.get('asistente') ?? '';

  const actividad = await getActividad(ciclo.corrida.ciclo_id, actividadId);
  if (!actividad) return new NextResponse('Actividad no encontrada', { status: 404 });

  const aporte = await getAporteDe(actividad.id, asistenteId);
  if (aporte?.valor?.tipo !== 'plan') {
    return new NextResponse('Todavía no hay nada para agendar', { status: 404 });
  }

  const evento = eventoDelPlan({
    dias: aporte.valor.dias,
    hora: aporte.valor.hora,
    texto: aporte.valor.texto,
    empresa: ciclo.empresa.nombre,
    desde: new Date(),
    id: aporte.id,
  });

  return new NextResponse(evento, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'attachment; filename="pausa-para-meditar.ics"',
      'cache-control': 'no-store',
    },
  });
}
