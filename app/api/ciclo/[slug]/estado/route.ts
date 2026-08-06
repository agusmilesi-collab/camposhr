import { NextResponse } from 'next/server';
import {
  getActividadAbierta,
  getAporteDe,
  listarAportes,
  resolverCiclo,
  type Actividad,
} from '@/lib/ciclo';

/**
 * Qué actividad está abierta en este momento.
 *
 * Lo consulta el teléfono de cada persona cada pocos segundos. Es la única vía
 * por la que el asistente se entera de que hay algo para responder: no hay menú
 * ni lista, justo para que nadie se adelante ni se pierda.
 *
 * Devuelve el enunciado y las opciones, nunca las respuestas de los demás. Lo
 * que responde el grupo se ve proyectado, no en el teléfono.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function publica(a: Actividad) {
  return {
    id: a.id,
    clave: a.clave,
    tipo: a.tipo,
    titulo: a.titulo,
    enunciado: a.enunciado,
    opciones: a.opciones,
  };
}

export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const ciclo = await resolverCiclo(params.slug);
  if (!ciclo) return new NextResponse('Ciclo no encontrado', { status: 404 });

  const actividad = await getActividadAbierta(ciclo.corrida);
  if (!actividad) {
    return NextResponse.json({ actividad: null, respondida: false, total: 0 });
  }

  const asistenteId = new URL(req.url).searchParams.get('asistente') ?? '';
  const [mio, todos] = await Promise.all([
    asistenteId ? getAporteDe(actividad.id, asistenteId) : Promise.resolve(null),
    listarAportes(ciclo.corrida.id, actividad.id),
  ]);

  return NextResponse.json({
    actividad: publica(actividad),
    // Si ya respondió, el teléfono le muestra su respuesta y la opción de
    // corregirla, en vez de un formulario vacío que invita a responder dos veces.
    respondida: Boolean(mio),
    mio: mio?.valor ?? null,
    total: todos.length,
  });
}
