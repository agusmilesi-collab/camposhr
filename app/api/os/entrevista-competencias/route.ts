import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { quienSoy } from '@/lib/identidad';
import { anotarAcceso } from '@/lib/accesos';

export const runtime = 'nodejs';

/**
 * Lo que la evaluadora escribió de la entrevista por competencias.
 *
 * Va en la evaluación, que es donde vive todo lo que la describe. El campo
 * vacío se guarda como null y no como cadena vacía: "todavía no se escribió" y
 * "se escribió nada" son lo mismo, y la ficha pregunta por el null.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Es una entrevista entera, no un párrafo: entra bastante más que un cualitativo. */
const LARGO_MAXIMO = 40000;

export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
    }
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });
  }

  const datos = await req.json().catch(() => null);
  const id = datos?.evaluacionId;
  if (typeof id !== 'string' || !UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Evaluación inválida.' }, { status: 400 });
  }

  const crudo = datos?.texto;
  if (crudo !== null && typeof crudo !== 'string') {
    return NextResponse.json({ ok: false, motivo: 'La entrevista tiene que ser texto.' }, { status: 400 });
  }
  if (typeof crudo === 'string' && crudo.length > LARGO_MAXIMO) {
    return NextResponse.json(
      { ok: false, motivo: `La entrevista supera los ${LARGO_MAXIMO} caracteres.` },
      { status: 400 }
    );
  }
  const texto = typeof crudo === 'string' && crudo.trim() ? crudo.trim() : null;

  const yo = await quienSoy();
  const res = await fetch(`${url}/rest/v1/evaluaciones?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      entrevista_competencias: texto,
      actualizado_at: new Date().toISOString(),
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, motivo: `Supabase respondió ${res.status}.` },
      { status: 400 }
    );
  }

  await anotarAcceso({
    quien: yo.nombre,
    accion: 'escritura',
    recurso: 'entrevista_competencias',
    recursoId: id,
    // El texto no va al registro de accesos: es lo que la persona contó en la
    // entrevista, y el registro se lee para saber quién tocó qué, no para
    // volver a leerlo.
    detalle: { largo: texto ? texto.length : 0 },
  });
  revalidateTag(CACHE_PSICOTECNICOS);
  return NextResponse.json({ ok: true });
}
