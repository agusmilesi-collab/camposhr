import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { enlaceDelGrafico, guardarGrafico } from '@/lib/grafico';
import { anotarAcceso } from '@/lib/accesos';
import { quienSoy } from '@/lib/identidad';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El dibujo de dos personas: se sube acá y se mira por enlace firmado.
 *
 * Es lo que la persona dibujó en papel, fotografiado o escaneado. No se
 * interpreta ni se procesa: se guarda para poder volver a verlo cuando se
 * escribe el informe, que es semanas después de la entrevista.
 */

const MAX = 15 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'];

async function sinSesion(): Promise<boolean> {
  if (!hayPuerta()) return false;
  const clave = process.env.OS_CLAVE as string;
  const cookie = cookies().get(COOKIE)?.value;
  return !cookie || !igual(cookie, await huella(clave));
}

export async function POST(req: Request) {
  if (await sinSesion()) {
    return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, motivo: 'No se pudo leer el formulario.' },
      { status: 400 }
    );
  }

  const id = (form.get('evaluacionId') ?? '').toString().trim();
  const adjunto = form.get('archivo');
  const archivo = adjunto instanceof File && adjunto.size > 0 ? adjunto : null;
  if (!archivo) {
    return NextResponse.json({ ok: false, motivo: 'No llegó ningún archivo.' }, { status: 400 });
  }
  if (archivo.size > MAX) {
    return NextResponse.json({ ok: false, motivo: 'El archivo supera los 15 MB.' }, { status: 400 });
  }
  // El tipo se mira, pero un teléfono puede mandar el suyo vacío: lo que no se
  // acepta es lo que declara ser otra cosa.
  if (archivo.type && !TIPOS.includes(archivo.type)) {
    return NextResponse.json(
      { ok: false, motivo: 'Tiene que ser una foto o un PDF.' },
      { status: 400 }
    );
  }

  try {
    const r = await guardarGrafico(id, archivo);
    if (!r.ok) return NextResponse.json(r, { status: 400 });

    const yo = await quienSoy();
    await anotarAcceso({
      quien: yo.nombre,
      accion: 'escritura',
      recurso: 'grafico_2_personas',
      recursoId: id,
      detalle: { nombre: archivo.name, bytes: archivo.size },
    });

    revalidateTag(CACHE_PSICOTECNICOS);
    return NextResponse.json({ ok: true, nombre: archivo.name });
  } catch (e) {
    console.error('grafico:', e);
    return NextResponse.json({ ok: false, motivo: 'No se pudo guardar.' }, { status: 500 });
  }
}

/** Abre el dibujo guardado, con un enlace que dura lo que tarda en abrirse. */
export async function GET(req: Request) {
  if (await sinSesion()) {
    return new NextResponse('Sin sesión.', { status: 401 });
  }
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const enlace = await enlaceDelGrafico(id);
  if (!enlace) return new NextResponse('No hay dibujo cargado.', { status: 404 });

  await anotarAcceso({
    quien: (await quienSoy()).nombre,
    accion: 'lectura',
    recurso: 'grafico_2_personas',
    recursoId: id,
  });
  return NextResponse.redirect(enlace);
}
