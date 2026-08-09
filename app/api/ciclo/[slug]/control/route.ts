import { NextResponse } from 'next/server';
import {
  abrirActividad,
  actividadesDelCiclo,
  cerrarActividades,
  claveControlOk,
  getActividad,
  repartirCruce,
  repartirEnsayo,
  resolverCiclo,
  rondasDelEnsayo,
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
      const actividadId = String(datos.actividadId ?? '');
      await abrirActividad(corrida.id, actividadId);

      // El cruce de la charla 3 no se responde: se reparte. Va acá, en el
      // momento en que la expositora la abre, para que el primer teléfono que
      // pregunte ya encuentre su pareja escrita en vez de armarla él.
      const actividad = await getActividad(corrida.ciclo_id, actividadId);
      if (actividad?.tipo === 'cruce') await repartirCruce(corrida, actividad);

      /*
       * El ensayo de la charla 4 se reparte igual, y las tres rondas de una
       * vez: quien empieza comunicando en la primera tiene que recibir en la
       * segunda con otra gente, y eso se decide todo junto o no cierra.
       *
       * Va acá y no en el sondeo por lo que pasó el 7 de agosto: si lo dispara
       * el teléfono, los treinta y tres entran casi juntos y los primeros leen
       * la sala entera antes de que la primera escritura llegue.
       */
      if (actividad?.tipo === 'ensayo') {
        await repartirEnsayo(corrida, rondasDelEnsayo(await actividadesDelCiclo(corrida.ciclo_id)));
      }
    } else {
      return new NextResponse('Acción inválida', { status: 400 });
    }
  } catch {
    return new NextResponse('No se pudo cambiar la actividad', { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
