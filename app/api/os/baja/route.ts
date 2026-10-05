import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_CLIENTES, CACHE_COMERCIAL, CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { anotarAcceso } from '@/lib/accesos';
import { ajustarPedidoDe } from '@/lib/pedido-completo';
import { hoy } from '@/lib/hora';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Marca que la persona se dio de baja del proceso, o lo deshace.
 *
 * Guarda el día y no toca la etapa: la etapa sigue diciendo hasta dónde llegó
 * la evaluación. Con la marca puesta, la evaluación sale de los tableros, el
 * portal la muestra como "Baja", no entra a la cola de facturación y no deja el
 * pedido abierto, así que después se revisa si el pedido se cierra.
 */
export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
    }
  }

  const datos = await req.json().catch(() => null);
  const id = datos?.id;
  const baja = datos?.baja;
  if (typeof id !== 'string' || !UUID.test(id) || typeof baja !== 'boolean') {
    return NextResponse.json({ ok: false, motivo: 'Pedido inválido.' }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });
  }

  const res = await fetch(`${url}/rest/v1/evaluaciones?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ baja_el: baja ? hoy() : null }),
    cache: 'no-store',
  });
  const filas = res.ok ? await res.json() : [];
  if (!res.ok || filas.length !== 1) {
    return NextResponse.json({ ok: false, motivo: 'No se pudo guardar.' }, { status: 400 });
  }

  await ajustarPedidoDe(id);
  await anotarAcceso({
    accion: 'escritura',
    recurso: 'evaluacion',
    detalle: { fila: id, baja: baja ? 'se dio de baja' : 'vuelve al proceso' },
  });

  revalidateTag(CACHE_PSICOTECNICOS);
  revalidateTag(CACHE_CLIENTES);
  revalidateTag(CACHE_COMERCIAL);
  return NextResponse.json({ ok: true, baja: filas[0].baja_el });
}
