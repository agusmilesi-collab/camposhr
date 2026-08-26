import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { quienSoy } from '@/lib/identidad';
import { anotarAcceso } from '@/lib/accesos';

export const runtime = 'nodejs';

/**
 * Con qué exigencia se lee un candidato, o un pedido entero.
 *
 * Null vuelve a lo de arriba: un candidato sin exigencia usa la de su pedido, y
 * un pedido sin exigencia usa la predeterminada. Por eso se guarda null y no la
 * predeterminada copiada: si mañana cambia cuál es la predeterminada, los que
 * no eligieron nada la siguen.
 *
 * **No recalcula nada.** Los puntajes salen del protocolo; lo que cambia es a
 * partir de qué número se los llama Adecuado, Alto o Sobresaliente.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Falta la configuración.' }, { status: 500 });
  }

  const datos = await req.json().catch(() => null);
  if (!datos) return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });

  const evaluacionId = String(datos.evaluacionId ?? '').trim();
  const pedidoId = String(datos.pedidoId ?? '').trim();
  const exigenciaId = String(datos.exigenciaId ?? '').trim();

  const tabla = evaluacionId ? 'evaluaciones' : 'pedidos';
  const id = evaluacionId || pedidoId;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: 'Falta a quién asignársela.' }, { status: 400 });
  }
  if (exigenciaId && !UUID.test(exigenciaId)) {
    return NextResponse.json({ error: 'Exigencia inválida.' }, { status: 400 });
  }

  const res = await fetch(`${url}/rest/v1/${tabla}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ exigencia_id: exigenciaId || null }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json({ error: `Supabase ${res.status}.` }, { status: 400 });
  }

  const yo = await quienSoy();
  await anotarAcceso({
    quien: yo.nombre,
    accion: 'escritura',
    recurso: tabla === 'evaluaciones' ? 'evaluacion' : 'pedido',
    recursoId: id,
    detalle: { exigencia: exigenciaId || null },
  });
  revalidateTag(CACHE_PSICOTECNICOS);
  return NextResponse.json({ ok: true });
}
