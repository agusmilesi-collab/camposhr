import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { enlaceDelBender, guardarBender } from '@/lib/grafico';
import { anotarAcceso } from '@/lib/accesos';
import { quienSoy } from '@/lib/identidad';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * La hoja del Bender: las nueve láminas dibujadas, en una imagen.
 *
 * Lo que llega acá ya está armado y comprimido: las nueve fotos se unen en el
 * navegador de la evaluadora, que es donde están. Subirlas de a una sería
 * mandar treinta megas para guardar dos, y dejaría nueve archivos sueltos que
 * hay que volver a ordenar cada vez.
 */

// Ya viene comprimida: si pesa más que esto, algo salió mal en el armado.
const MAX = 8 * 1024 * 1024;

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
  const cuantas = Number(form.get('cuantas') ?? 0);
  const adjunto = form.get('archivo');
  const archivo = adjunto instanceof File && adjunto.size > 0 ? adjunto : null;
  if (!archivo) {
    return NextResponse.json({ ok: false, motivo: 'No llegó ninguna imagen.' }, { status: 400 });
  }
  if (archivo.size > MAX) {
    return NextResponse.json({ ok: false, motivo: 'La hoja supera los 8 MB.' }, { status: 400 });
  }
  if (!Number.isInteger(cuantas) || cuantas < 1 || cuantas > 9) {
    return NextResponse.json({ ok: false, motivo: 'Cantidad de láminas inválida.' }, { status: 400 });
  }

  try {
    const r = await guardarBender(id, archivo, cuantas);
    if (!r.ok) return NextResponse.json(r, { status: 400 });

    const yo = await quienSoy();
    await anotarAcceso({
      quien: yo.nombre,
      accion: 'escritura',
      recurso: 'bender',
      recursoId: id,
      detalle: { laminas: cuantas, bytes: archivo.size },
    });

    revalidateTag(CACHE_PSICOTECNICOS);
    return NextResponse.json({ ok: true, cuantas });
  } catch (e) {
    console.error('bender:', e);
    return NextResponse.json({ ok: false, motivo: 'No se pudo guardar.' }, { status: 500 });
  }
}

/** Abre la hoja guardada, con un enlace que dura lo que tarda en abrirse. */
export async function GET(req: Request) {
  if (await sinSesion()) {
    return new NextResponse('Sin sesión.', { status: 401 });
  }
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const enlace = await enlaceDelBender(id);
  if (!enlace) return new NextResponse('No hay hoja cargada.', { status: 404 });

  await anotarAcceso({
    quien: (await quienSoy()).nombre,
    accion: 'lectura',
    recurso: 'bender',
    recursoId: id,
  });
  return NextResponse.redirect(enlace);
}
