import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_CLIENTES, CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { borrarCandidato, editarCandidato } from '@/lib/candidatos';
import { anotarAcceso } from '@/lib/accesos';
import { quienSoy } from '@/lib/identidad';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CV = 10 * 1024 * 1024;

/** La sesión se comprueba acá además del middleware, que filtra por host. */
async function sinSesion(): Promise<boolean> {
  if (!hayPuerta()) return false;
  const clave = process.env.OS_CLAVE as string;
  const cookie = cookies().get(COOKIE)?.value;
  return !cookie || !igual(cookie, await huella(clave));
}

/**
 * Corrige los datos de un candidato ya cargado.
 *
 * Recibe un formulario y no JSON, porque puede traer el CV adjunto.
 */
export async function POST(req: Request) {
  if (await sinSesion()) {
    return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'No se pudo leer el formulario.' }, { status: 400 });
  }

  const texto = (k: string) => (form.get(k) ?? '').toString().trim();
  const id = texto('id');
  const adjunto = form.get('cv');
  const cv = adjunto instanceof File && adjunto.size > 0 ? adjunto : null;
  if (cv && cv.size > MAX_CV) {
    return NextResponse.json({ ok: false, motivo: 'El CV supera los 10 MB.' }, { status: 400 });
  }

  try {
    const r = await editarCandidato(id, {
      nombre: texto('nombre'),
      email: texto('email') || null,
      telefono: texto('telefono') || null,
      pedidoId: texto('pedidoId'),
      evaluadora: texto('evaluadora'),
      cv,
    });
    if (!r.ok) return NextResponse.json(r, { status: 400 });

    const yo = await quienSoy();
    await anotarAcceso({
      quien: yo.nombre,
      accion: 'escritura',
      recurso: 'evaluacion',
      recursoId: id,
      detalle: { nombre: texto('nombre'), con_cv: Boolean(cv), edicion: 'tablero' },
    });

    revalidateTag(CACHE_CLIENTES);
    revalidateTag(CACHE_PSICOTECNICOS);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('candidatos:', e);
    return NextResponse.json({ ok: false, motivo: 'No se pudo guardar.' }, { status: 500 });
  }
}

/**
 * Borra un candidato del tablero.
 *
 * Queda anotado en `accesos` con su propia acción: lo que el registro tiene
 * que poder contestar es quién sacó una evaluación de la base y cuándo.
 */
export async function DELETE(req: Request) {
  if (await sinSesion()) {
    return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  }

  let datos: { id?: unknown };
  try {
    datos = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'Cuerpo inválido.' }, { status: 400 });
  }

  const id = typeof datos.id === 'string' ? datos.id : '';

  try {
    const r = await borrarCandidato(id);
    if (!r.ok) return NextResponse.json(r, { status: 400 });

    const yo = await quienSoy();
    await anotarAcceso({
      quien: yo.nombre,
      accion: 'borrado',
      recurso: 'evaluacion',
      recursoId: id,
      detalle: { nombre: r.nombre, desde: 'tablero' },
    });

    revalidateTag(CACHE_CLIENTES);
    revalidateTag(CACHE_PSICOTECNICOS);
    return NextResponse.json({ ok: true, nombre: r.nombre });
  } catch (e) {
    console.error('candidatos:', e);
    return NextResponse.json({ ok: false, motivo: 'No se pudo borrar.' }, { status: 500 });
  }
}
