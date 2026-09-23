import { NextResponse } from 'next/server';
import {
  actividadesDelCiclo,
  getActividadPorClave,
  primeraDelRanking,
  reclamarAporte,
  resolverCiclo,
} from '@/lib/ciclo';

/**
 * Reclamar el pozo de una pregunta.
 *
 * Solo lo toca quien escribió la más votada, y cobrarlo es decir que fue suya: el nombre
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

  // Solo tiene premio la más votada, y recién cuando la placa la reveló. La
  // 2ª y la 3ª quedan anónimas: sin este control, un pedido armado a mano
  // ponía el nombre de su autor al lado de la pregunta.
  const asistenteId = String(datos.asistenteId ?? '');
  const votacion = (await actividadesDelCiclo(ciclo.corrida.ciclo_id)).find(
    (a) => a.tipo === 'monedas' && a.config?.desde === actividad.clave
  );
  if (!votacion || ciclo.corrida.revelado < 2) {
    return new NextResponse('Todavía no hay premio para reclamar', { status: 409 });
  }
  const primera = await primeraDelRanking(ciclo.corrida, votacion, actividad.id);
  if (!primera || primera.aporte.asistente_id !== asistenteId) {
    return new NextResponse('No hay nada tuyo que reclamar', { status: 400 });
  }

  const ok = await reclamarAporte(actividad.id, asistenteId);
  if (!ok) return new NextResponse('No hay nada tuyo que reclamar', { status: 400 });

  return NextResponse.json({ ok: true });
}
