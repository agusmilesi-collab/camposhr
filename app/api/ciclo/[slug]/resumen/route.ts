import { NextResponse } from 'next/server';
import { actividadesDelCiclo, aportesDeEn, resolverCiclo } from '@/lib/ciclo';

/**
 * Lo que escribió una persona, para su repaso.
 *
 * Solo lo suyo: el id viaja desde su propio teléfono, que es el que lo guardó
 * al registrarse. No devuelve nada de nadie más.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const ciclo = await resolverCiclo(params.slug);
  if (!ciclo) return new NextResponse('Ciclo no encontrado', { status: 404 });

  const asistenteId = new URL(req.url).searchParams.get('asistente') ?? '';
  if (!asistenteId) return NextResponse.json({ mio: null });

  const catalogo = await actividadesDelCiclo(ciclo.corrida.ciclo_id);
  const reconocimiento = catalogo.find((a) => a.clave === 'cd-reconocimiento-traducido');
  const conversacion = catalogo.find((a) => a.clave === 'cd-traduccion');

  const pedidas = [reconocimiento?.id, conversacion?.id].filter(
    (id): id is string => Boolean(id)
  );
  const propios = await aportesDeEn(pedidas, asistenteId);

  const delReconocimiento = reconocimiento ? propios.get(reconocimiento.id)?.valor : null;
  const deLaConversacion = conversacion ? propios.get(conversacion.id)?.valor : null;

  if (!delReconocimiento && !deLaConversacion) {
    return NextResponse.json({ mio: null });
  }

  // El nombre sale de la sala y no del cliente: el teléfono manda un id y nada
  // más, y así no hay forma de pedir lo de otro escribiendo otro nombre.
  const sala = await import('@/lib/ciclo').then((m) =>
    m.asistentesDeLaSala(ciclo.corrida.id)
  );
  const quien = sala.find((a) => a.id === asistenteId);

  return NextResponse.json({
    mio: {
      nombre: quien?.nombre ?? '',
      reconocimiento:
        delReconocimiento?.tipo === 'campos' ? delReconocimiento.campos : null,
      conversacion:
        deLaConversacion?.tipo === 'campos' ? deLaConversacion.campos : null,
    },
  });
}
