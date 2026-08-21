import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { calcularRaven, RAVEN_MAXIMO } from '@/lib/raven';
import { anotarAcceso } from '@/lib/accesos';
import { quienSoy } from '@/lib/identidad';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guarda el puntaje directo del Raven, con lo que sale de él.
 *
 * El percentil, los desvíos y el rango se calculan acá y se guardan junto al
 * puntaje: son tres cosas derivadas de una, y guardarlas evita que la pantalla
 * y el informe puedan discrepar si alguna vez cambia el baremo.
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
  const id = datos?.evaluacionId;
  if (typeof id !== 'string' || !UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Evaluación inválida.' }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });
  }

  // Un puntaje vacío borra la medición: no es lo mismo que un cero.
  const crudo = datos?.raw;
  const raw = crudo === null || crudo === undefined || crudo === '' ? null : Number(crudo);
  if (raw !== null && (!Number.isFinite(raw) || raw < 0 || raw > RAVEN_MAXIMO)) {
    return NextResponse.json(
      { ok: false, motivo: `El puntaje va de 0 a ${RAVEN_MAXIMO}.` },
      { status: 400 }
    );
  }

  const r = calcularRaven(raw);
  const fila = {
    evaluacion_id: id,
    raw: r?.raw ?? null,
    percentil: r?.percentil ?? null,
    desvios: r?.desvios ?? null,
    resultado: r?.resultado ?? null,
    // Quien escribe por acá es la evaluadora, con el puntaje de un Raven que se
    // tomó en papel. Queda declarado para que la ficha no tenga que deducirlo
    // de si existe una sesión, que es una deducción que se equivoca cuando la
    // persona además rindió por su enlace.
    origen: 'manual',
    actualizado_at: new Date().toISOString(),
  };

  const res = await fetch(`${url}/rest/v1/raven`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(fila),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, motivo: `Supabase respondió ${res.status}: ${await res.text()}` },
      { status: 500 }
    );
  }

  const yo = await quienSoy();
  await anotarAcceso({
    quien: yo.nombre,
    accion: 'escritura',
    recurso: 'raven',
    recursoId: id,
    detalle: { raw: fila.raw, resultado: fila.resultado },
  });

  revalidateTag(CACHE_PSICOTECNICOS);
  return NextResponse.json({ ok: true, raven: r });
}
