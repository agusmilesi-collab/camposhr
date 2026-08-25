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
 * Lo que se puede cambiar de una batería, menos el precio.
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

/** Cuánto puede durar una batería. Diez horas ya es otra cosa, no un error de tipeo. */
const MINUTOS_MAXIMO = 600;

/** Un texto que va al portal del cliente: se recorta y no puede quedar vacío. */
function texto(v: unknown, largo: number): string | null {
  if (typeof v !== 'string') return null;
  const limpio = v.trim();
  return limpio && limpio.length <= largo ? limpio : null;
}

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

  const nombre = texto(datos?.nombre, 120);
  const descripcion = texto(datos?.descripcion, 600);
  const paraQuien = texto(datos?.paraQuien, 300);
  if (!nombre || !descripcion || !paraQuien) {
    return NextResponse.json(
      {
        ok: false,
        motivo:
          'El nombre, qué incluye y para quién se recomienda van los tres, y son lo que el cliente lee al elegir.',
      },
      { status: 400 }
    );
  }

  // La duración puede faltar, que es distinto de valer cero: cero minutos sería
  // una batería que no se toma.
  const duracion = datos?.duracion;
  const minutos =
    duracion === null || duracion === undefined || duracion === ''
      ? null
      : Number(duracion);
  if (minutos !== null && (!Number.isInteger(minutos) || minutos <= 0 || minutos > MINUTOS_MAXIMO)) {
    return NextResponse.json(
      { ok: false, motivo: `La duración va en minutos enteros, de 1 a ${MINUTOS_MAXIMO}.` },
      { status: 400 }
    );
  }

  const res = await fetch(`${url}/rest/v1/baterias?id=eq.${bateriaId}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      nombre,
      descripcion,
      para_quien: paraQuien,
      duracion_min: minutos,
      tests: revisado.tests,
      outputs: revisado.entregables,
    }),
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
    detalle: {
      nombre,
      minutos,
      toma: revisado.tests.join(' · '),
      entrega: revisado.entregables.join(' · '),
    },
  });
  revalidateTag(CACHE_PSICOTECNICOS);
  return NextResponse.json({ ok: true });
}
