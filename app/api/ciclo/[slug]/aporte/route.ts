import { NextResponse } from 'next/server';
import {
  getActividad,
  getAsistente,
  guardarAporte,
  normalizarValor,
  resolverCiclo,
} from '@/lib/ciclo';

/**
 * Lo que responde una persona en la actividad abierta.
 *
 * Se valida contra la actividad guardada, no contra lo que dice el navegador:
 * el tipo, el rango de la escala y los índices de las opciones salen de la fila
 * de `actividades`.
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

  let datos: { actividadId?: unknown; asistenteId?: unknown; valor?: unknown };
  try {
    datos = await req.json();
  } catch {
    return new NextResponse('Datos ilegibles', { status: 400 });
  }

  const actividad = await getActividad(corrida.ciclo_id, String(datos.actividadId ?? ''));
  if (!actividad) return new NextResponse('Actividad no encontrada', { status: 404 });

  // Cerrada quiere decir cerrada: una vez que la expositora la cierra, lo que
  // llega tarde no entra. Si no, el conteo proyectado sigue moviéndose mientras
  // ella ya está hablando de otra cosa.
  if (corrida.actividad_abierta_id !== actividad.id) {
    return new NextResponse('La actividad está cerrada', { status: 409 });
  }

  const asistente = await getAsistente(corrida.id, String(datos.asistenteId ?? ''));
  if (!asistente) return new NextResponse('Asistente no encontrado', { status: 404 });

  let valor;
  try {
    valor = normalizarValor(actividad, datos.valor);
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 400 });
  }

  try {
    await guardarAporte(corrida.id, actividad.id, asistente.id, valor);
  } catch {
    return new NextResponse('No se pudo guardar', { status: 500 });
  }

  return NextResponse.json({ ok: true, valor });
}
