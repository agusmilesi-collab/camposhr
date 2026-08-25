import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { quienSoy } from '@/lib/identidad';
import { anotarAcceso } from '@/lib/accesos';
import { contenidoValido } from '@/lib/baterias-contenido';

export const runtime = 'nodejs';

/**
 * Qué se toma y qué se entrega en una batería.
 *
 * **Vale para adelante y no reescribe lo hecho.** Una evaluación ya tomada
 * conserva lo que se le tomó, que son sus marcas de administrado; lo que cambia
 * es lo que se le va a pedir a la próxima. El precio funciona igual, con su
 * historia (`app/api/os/precios`).
 *
 * Lo que llega se valida acá: una batería con los dos tests de manchas no falla
 * al guardarse, falla meses después en la ficha de alguien.
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
  const bateriaId = datos?.bateriaId;
  if (typeof bateriaId !== 'string' || !UUID.test(bateriaId)) {
    return NextResponse.json({ ok: false, motivo: 'Batería inválida.' }, { status: 400 });
  }

  const revisado = contenidoValido(datos?.tests, datos?.outputs);
  if (!revisado.ok) {
    return NextResponse.json({ ok: false, motivo: revisado.motivo }, { status: 400 });
  }

  const res = await fetch(`${url}/rest/v1/baterias?id=eq.${bateriaId}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ tests: revisado.tests, outputs: revisado.entregables }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, motivo: `Supabase respondió ${res.status}.` },
      { status: 400 }
    );
  }

  const yo = await quienSoy();
  await anotarAcceso({
    quien: yo.nombre,
    accion: 'escritura',
    recurso: 'bateria',
    recursoId: bateriaId,
    detalle: { toma: revisado.tests.join(' · '), entrega: revisado.entregables.join(' · ') },
  });
  revalidateTag(CACHE_PSICOTECNICOS);
  return NextResponse.json({ ok: true });
}
