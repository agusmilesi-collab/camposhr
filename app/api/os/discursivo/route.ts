import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { quienSoy } from '@/lib/identidad';
import { anotarAcceso } from '@/lib/accesos';
import { esNivel } from '@/lib/discursivo';

export const runtime = 'nodejs';

/**
 * El nivel del análisis discursivo y sus dos textos.
 *
 * El nivel es una de las cuatro posiciones de la pirámide y lo ubica la
 * evaluadora: acá solo se comprueba que sea una de ellas. Null lo borra, que es
 * lo que hace falta cuando se eligió el escalón equivocado.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LARGO_MAXIMO = 4000;

function parrafo(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const limpio = v.trim();
  return limpio ? limpio.slice(0, LARGO_MAXIMO) : null;
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
  const id = datos?.evaluacionId;
  if (typeof id !== 'string' || !UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Evaluación inválida.' }, { status: 400 });
  }

  const nivel = datos?.nivel;
  if (nivel !== null && !esNivel(nivel)) {
    return NextResponse.json(
      { ok: false, motivo: 'El nivel tiene que ser uno de los cuatro de la pirámide.' },
      { status: 400 }
    );
  }

  const yo = await quienSoy();

  /**
   * Solo se pisa lo que vino en el cuerpo.
   *
   * El upsert reemplaza la fila entera, así que mandar la ficha con el nivel
   * solo, que es lo que hace la pantalla donde se elige el escalón, borraba los
   * dos párrafos de quien los hubiera escrito. Una clave ausente es "no lo
   * toques" y no "ponelo en null".
   */
  const fila: Record<string, unknown> = {
    evaluacion_id: id,
    nivel,
    quien: yo.nombre,
    actualizado_at: new Date().toISOString(),
  };
  for (const campo of ['actual', 'futura'] as const) {
    if (campo in (datos ?? {})) fila[campo] = parrafo(datos?.[campo]);
  }
  if (!('actual' in fila) || !('futura' in fila)) {
    const antes = await fetch(
      `${url}/rest/v1/analisis_discursivo?evaluacion_id=eq.${id}&select=actual,futura`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' }
    );
    const suya = (await antes.json().catch(() => []))[0] ?? {};
    if (!('actual' in fila)) fila.actual = suya.actual ?? null;
    if (!('futura' in fila)) fila.futura = suya.futura ?? null;
  }

  const res = await fetch(`${url}/rest/v1/analisis_discursivo?on_conflict=evaluacion_id`, {
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
      { ok: false, motivo: `Supabase respondió ${res.status}.` },
      { status: 400 }
    );
  }

  await anotarAcceso({
    quien: yo.nombre,
    accion: 'escritura',
    recurso: 'analisis_discursivo',
    recursoId: id,
    detalle: { nivel: nivel ?? 'sin ubicar' },
  });
  revalidateTag(CACHE_PSICOTECNICOS);
  return NextResponse.json({ ok: true });
}
