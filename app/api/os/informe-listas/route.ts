import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { anotarAcceso } from '@/lib/accesos';
import { LISTAS_DEL_INFORME, type ListaDelInforme } from '@/lib/informe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo que entra en un ítem: un párrafo, no un documento. */
const LARGO = 600;

/**
 * Guarda las listas del informe que escribió la evaluadora.
 *
 * Se guarda la lista entera y no el ítem que cambió: el orden es parte del
 * dato, así que arrastrar sin editar también es un cambio que hay que guardar.
 *
 * **Mandar `null` devuelve la sección a lo calculado.** Es la única forma de
 * volver atrás: borrar la clave, no dejarla vacía. Una lista vacía significa
 * que la sección va sin ítems, que es una decisión distinta.
 */
export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
    }
  }

  let datos: any;
  try {
    datos = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'Cuerpo inválido.' }, { status: 400 });
  }

  const { id, lista, items } = datos ?? {};
  if (typeof id !== 'string' || !UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Identificador inválido.' }, { status: 400 });
  }
  if (!LISTAS_DEL_INFORME.includes(lista)) {
    return NextResponse.json({ ok: false, motivo: 'Lista desconocida.' }, { status: 400 });
  }
  const volver = items === null;
  if (!volver) {
    if (!Array.isArray(items) || items.some((t) => typeof t !== 'string')) {
      return NextResponse.json({ ok: false, motivo: 'Ítems inválidos.' }, { status: 400 });
    }
    if (items.some((t: string) => t.length > LARGO)) {
      return NextResponse.json(
        { ok: false, motivo: `Ningún ítem puede pasar de ${LARGO} caracteres.` },
        { status: 400 }
      );
    }
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });
  }
  const cabeceras = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  // Se lee lo guardado y se vuelve a escribir el objeto entero: PostgREST no
  // sabe cambiar una sola clave de un jsonb, y las otras tres listas tienen que
  // sobrevivir a que se toque esta.
  const previo = await fetch(
    `${url}/rest/v1/evaluaciones?id=eq.${id}&select=informe_listas`,
    { headers: cabeceras, cache: 'no-store' }
  );
  if (!previo.ok) {
    return NextResponse.json(
      { ok: false, motivo: `No se pudo leer la evaluación (${previo.status}).` },
      { status: 400 }
    );
  }
  const fila = (await previo.json())[0];
  if (!fila) {
    return NextResponse.json({ ok: false, motivo: 'No existe esa evaluación.' }, { status: 404 });
  }

  const guardadas: Record<string, unknown> = { ...(fila.informe_listas ?? {}) };
  if (volver) delete guardadas[lista as ListaDelInforme];
  else guardadas[lista as ListaDelInforme] = (items as string[]).map((t) => t.trim()).filter(Boolean);

  const res = await fetch(`${url}/rest/v1/evaluaciones?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...cabeceras, Prefer: 'return=minimal' },
    body: JSON.stringify({ informe_listas: guardadas }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, motivo: `No se pudo guardar (${res.status}).` },
      { status: 400 }
    );
  }

  await anotarAcceso({
    accion: 'escritura',
    recurso: 'evaluacion',
    detalle: { fila: id, lista, items: volver ? 'vuelve a lo calculado' : (items as string[]).length },
  });

  revalidateTag(CACHE_PSICOTECNICOS);
  return NextResponse.json({ ok: true, listas: guardadas });
}
