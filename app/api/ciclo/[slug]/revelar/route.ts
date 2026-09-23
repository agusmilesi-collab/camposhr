import { NextResponse } from 'next/server';
import {
  abrirActividad,
  getActividad,
  resolverCiclo,
  revelarPrimera,
  revelarSiguiente,
} from '@/lib/ciclo';

/**
 * Revela la pregunta siguiente del ranking: la 2ª con el botón de su placa, y
 * la 1ª cuando se llega a la placa que la muestra sola.
 *
 * Va sin clave a propósito: el botón vive en la placa, que es pública. Por eso
 * solo avanza de a un paso y nunca vuelve atrás (ver `revelarSiguiente`).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const ciclo = await resolverCiclo(params.slug, true);
  if (!ciclo) return new NextResponse('Ciclo no encontrado', { status: 404 });

  let cuerpo: { desde?: unknown; primera?: unknown; reclamo?: unknown } = {};
  try {
    cuerpo = (await req.json()) ?? {};
  } catch {
    return new NextResponse('Datos ilegibles', { status: 400 });
  }

  // Abrir los teléfonos para reclamar el pozo, desde la card de la placa de la
  // primera. Sin clave, así que se limita a eso: solo abre una votación de
  // monedas, y solo cuando ya está cerrada, que es cuando el teléfono deja de
  // votar y le ofrece el premio a quien escribió la primera.
  if (typeof cuerpo.reclamo === 'string') {
    const actividad = await getActividad(ciclo.corrida.ciclo_id, cuerpo.reclamo);
    if (actividad?.tipo !== 'monedas' || ciclo.corrida.revelado < 2) {
      return new NextResponse('Todavía no', { status: 409 });
    }
    await abrirActividad(ciclo.corrida.id, actividad.id);
    return NextResponse.json({ ok: true });
  }

  // La placa de la primera la pide al aparecer; el botón de la 2ª avanza un paso.
  if (cuerpo.primera === true) await revelarPrimera(ciclo.corrida.id);
  else await revelarSiguiente(ciclo.corrida.id, Number(cuerpo.desde));
  return NextResponse.json({ ok: true });
}
