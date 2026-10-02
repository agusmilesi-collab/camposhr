import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { anotarAcceso } from '@/lib/accesos';
import { LISTAS_DEL_INFORME, PARRAFOS_BENZIGER, type ListaDelInforme } from '@/lib/informe';
import { esTramo } from '@/lib/plan-incorporacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo que entra en un ítem: un párrafo, no un documento. */
const LARGO = 600;

/** Un párrafo del capítulo Benziger: el de cómo es pasa los 600. */
const LARGO_PARRAFO = 2000;

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
  /* El capítulo Benziger no es una lista: son cuatro párrafos con nombre
     (`PARRAFOS_BENZIGER`), y se guardan solo los que la evaluadora cambió. */
  const esBenziger = lista === 'benziger';
  if (!esBenziger && !LISTAS_DEL_INFORME.includes(lista)) {
    return NextResponse.json({ ok: false, motivo: 'Lista desconocida.' }, { status: 400 });
  }
  const volver = items === null;
  if (esBenziger && !volver) {
    const valido =
      items &&
      typeof items === 'object' &&
      !Array.isArray(items) &&
      Object.entries(items).every(
        ([k, v]) => (PARRAFOS_BENZIGER as readonly string[]).includes(k) && typeof v === 'string'
      );
    if (!valido) {
      return NextResponse.json({ ok: false, motivo: 'Párrafos inválidos.' }, { status: 400 });
    }
    if (Object.values(items as Record<string, string>).some((t) => t.length > LARGO_PARRAFO)) {
      return NextResponse.json(
        { ok: false, motivo: `Ningún párrafo puede pasar de ${LARGO_PARRAFO} caracteres.` },
        { status: 400 }
      );
    }
  }
  /* El plan de incorporación guarda cada renglón con su tramo; las otras tres
     listas, el texto solo. */
  const conTramo = lista === 'recomendaciones';
  const textoDe = (x: any): string => (conTramo ? x?.texto : x);
  if (!volver && !esBenziger) {
    const valido = (x: any) =>
      conTramo
        ? x && typeof x === 'object' && typeof x.texto === 'string' && esTramo(x.tramo)
        : typeof x === 'string';
    if (!Array.isArray(items) || !items.every(valido)) {
      return NextResponse.json({ ok: false, motivo: 'Ítems inválidos.' }, { status: 400 });
    }
    if (items.some((x: any) => textoDe(x).length > LARGO)) {
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
  if (volver) delete guardadas[lista as string];
  else if (esBenziger) {
    // Un párrafo vacío no se guarda: vuelve a lo calculado. Para que un
    // párrafo no salga, se lo saca desde Configuración.
    const suyos = Object.fromEntries(
      Object.entries(items as Record<string, string>)
        .map(([k, v]) => [k, v.trim()])
        .filter(([, v]) => v)
    );
    if (Object.keys(suyos).length > 0) guardadas.benziger = suyos;
    else delete guardadas.benziger;
  } else
    guardadas[lista as ListaDelInforme] = conTramo
      ? (items as { texto: string; tramo: string }[])
          .map((x) => ({ texto: x.texto.trim(), tramo: x.tramo }))
          .filter((x) => x.texto)
      : (items as string[]).map((t) => t.trim()).filter(Boolean);

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
    detalle: {
      fila: id,
      lista,
      items: volver ? 'vuelve a lo calculado' : esBenziger ? Object.keys(items).length : (items as string[]).length,
    },
  });

  revalidateTag(CACHE_PSICOTECNICOS);
  return NextResponse.json({ ok: true, listas: guardadas });
}
