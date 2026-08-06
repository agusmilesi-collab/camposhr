import { NextResponse } from 'next/server';
import { subirSelfie } from '@/lib/supabase';
import { crearAsistente, resolverCiclo } from '@/lib/ciclo';

/**
 * Alta de un asistente. Se hace una sola vez por ciclo, no por encuentro.
 *
 * La foto es la llave del segundo día: con ella, quien vuelve desde otro
 * teléfono se reconoce en la grilla de caras en lugar de escribir un código.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FOTO = 3 * 1024 * 1024; // 3 MB

export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const ciclo = await resolverCiclo(params.slug);
  if (!ciclo) return new NextResponse('Ciclo no encontrado', { status: 404 });
  const { empresa, corrida } = ciclo;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new NextResponse('Formato inválido', { status: 400 });
  }

  const nombre = String(form.get('nombre') ?? '').trim().slice(0, 80);
  const apellido = String(form.get('apellido') ?? '').trim().slice(0, 80);
  if (nombre.length < 2) return new NextResponse('Falta el nombre', { status: 400 });
  if (apellido.length < 2) return new NextResponse('Falta el apellido', { status: 400 });

  let fotoPath: string | null = null;
  const foto = form.get('foto');
  if (foto instanceof File && foto.size > 0) {
    if (foto.size > MAX_FOTO || !foto.type.startsWith('image/')) {
      return new NextResponse('Foto inválida', { status: 400 });
    }
    try {
      const ruta = `${empresa.slug}/ciclo/${crypto.randomUUID()}.jpg`;
      fotoPath = await subirSelfie(ruta, await foto.arrayBuffer(), foto.type);
    } catch {
      // Si falla la subida, la persona igual queda registrada: quedarse afuera
      // del encuentro por una foto sería peor que no tenerla.
      fotoPath = null;
    }
  }

  try {
    const asistente = await crearAsistente({
      corrida_id: corrida.id,
      nombre,
      apellido,
      foto_path: fotoPath,
    });
    return NextResponse.json({
      ok: true,
      asistente: { id: asistente.id, nombre: asistente.nombre },
    });
  } catch {
    return new NextResponse('No se pudo registrar', { status: 500 });
  }
}
