import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { anotarAcceso } from '@/lib/accesos';
import { quienSoy } from '@/lib/identidad';
import { borrarAudio, guardarAudio, MAX_AUDIO } from '@/lib/audio-discurso';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * La grabación de los cinco minutos, que se sube y se saca.
 *
 * Va en su propia ruta y no en la del análisis porque viaja como formulario con
 * un archivo adentro, y el resto del análisis son campos sueltos en JSON.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Evaluación inválida.' }, { status: 400 });
  }
  const adjunto = form.get('archivo');
  const archivo = adjunto instanceof File && adjunto.size > 0 ? adjunto : null;
  if (!archivo) {
    return NextResponse.json({ ok: false, motivo: 'No llegó ningún archivo.' }, { status: 400 });
  }
  if (archivo.size > MAX_AUDIO) {
    return NextResponse.json({ ok: false, motivo: 'La grabación supera los 25 MB.' }, { status: 400 });
  }

  try {
    const yo = await quienSoy();
    const r = await guardarAudio(id, archivo, yo.nombre);
    if (!r.ok) return NextResponse.json(r, { status: 400 });

    await anotarAcceso({
      quien: yo.nombre,
      accion: 'escritura',
      recurso: 'discurso',
      recursoId: id,
      detalle: { bytes: archivo.size, nombre: archivo.name },
    });
    revalidateTag(CACHE_PSICOTECNICOS);
    return NextResponse.json({ ok: true, nombre: r.nombre });
  } catch (e) {
    console.error('discurso-audio:', e);
    return NextResponse.json({ ok: false, motivo: 'No se pudo guardar.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (await sinSesion()) {
    return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Evaluación inválida.' }, { status: 400 });
  }
  const ok = await borrarAudio(id);
  if (!ok) {
    return NextResponse.json({ ok: false, motivo: 'No se pudo borrar.' }, { status: 400 });
  }
  const yo = await quienSoy();
  await anotarAcceso({
    quien: yo.nombre,
    accion: 'borrado',
    recurso: 'discurso',
    recursoId: id,
  });
  revalidateTag(CACHE_PSICOTECNICOS);
  return NextResponse.json({ ok: true });
}
