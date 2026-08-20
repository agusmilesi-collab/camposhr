import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_CLIENTES, CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { anotarAcceso } from '@/lib/accesos';
import { CAMPOS_PEDIDO, ESTADOS_PEDIDO } from '@/lib/pedido-campos';

export const runtime = 'nodejs';

/**
 * Guarda un cambio en un pedido.
 *
 * Los campos editables están declarados en `CAMPOS_PEDIDO` y no se acepta
 * ninguno fuera de esa lista: la ruta recibe el nombre de la columna desde el
 * navegador y sin la lista cualquiera podría escribir `empresa_id`.
 *
 * `bateria_id` y `con_benziger` se aceptan aparte porque no son texto: uno es
 * una referencia y el otro un booleano.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const id = datos?.id;
  const campo = datos?.campo;
  const valor = datos?.valor;

  if (typeof id !== 'string' || !UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Pedido inválido.' }, { status: 400 });
  }

  let fila: Record<string, unknown>;

  if (campo === 'bateria_id') {
    if (valor !== null && !(typeof valor === 'string' && UUID.test(valor))) {
      return NextResponse.json({ ok: false, motivo: 'Batería inválida.' }, { status: 400 });
    }
    fila = { bateria_id: valor };
  } else if (campo === 'con_benziger') {
    if (typeof valor !== 'boolean') {
      return NextResponse.json({ ok: false, motivo: 'Valor inválido.' }, { status: 400 });
    }
    fila = { con_benziger: valor };
  } else if (typeof campo === 'string' && CAMPOS_PEDIDO.includes(campo)) {
    if (valor !== null && typeof valor !== 'string') {
      return NextResponse.json({ ok: false, motivo: 'Valor inválido.' }, { status: 400 });
    }
    if (campo === 'estado' && !ESTADOS_PEDIDO.includes(valor)) {
      return NextResponse.json({ ok: false, motivo: 'Estado inválido.' }, { status: 400 });
    }
    if (campo === 'puesto' && !String(valor ?? '').trim()) {
      return NextResponse.json({ ok: false, motivo: 'El puesto no puede quedar vacío.' }, { status: 400 });
    }
    fila = { [campo]: valor === '' ? null : valor };
  } else {
    return NextResponse.json({ ok: false, motivo: 'Campo no editable.' }, { status: 400 });
  }

  const res = await fetch(`${url}/rest/v1/pedidos?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(fila),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, motivo: `Supabase respondió ${res.status}: ${await res.text()}` },
      { status: 400 }
    );
  }

  await anotarAcceso({
    accion: 'escritura',
    recurso: 'pedido',
    recursoId: id,
    detalle: fila,
  });

  revalidateTag(CACHE_PSICOTECNICOS);
  revalidateTag(CACHE_CLIENTES);

  return NextResponse.json({ ok: true });
}
