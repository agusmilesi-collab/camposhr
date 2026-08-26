import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { quienSoy } from '@/lib/identidad';
import { anotarAcceso } from '@/lib/accesos';
import { edadA } from '@/lib/edad';

export const runtime = 'nodejs';

/**
 * La fecha de nacimiento del candidato, y la edad que se congela con ella.
 *
 * Es la primera pregunta de la entrevista por competencias. La fecha se guarda
 * en la persona, que es de quien es; la edad se guarda en la evaluación, contra
 * el día de la entrevista, porque el informe dice qué edad tenía cuando se la
 * evaluó y no cuántos años tiene hoy.
 *
 * Si la fecha de la entrevista todavía no está cargada, se cuenta contra hoy,
 * que es el día en que la evaluadora la tiene enfrente y se la pregunta.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

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
  const id = String(datos?.evaluacionId ?? '').trim();
  if (!UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Evaluación inválida.' }, { status: 400 });
  }

  const nacimiento = datos?.nacimiento === null ? null : String(datos?.nacimiento ?? '').trim();
  if (nacimiento && !FECHA.test(nacimiento)) {
    return NextResponse.json({ ok: false, motivo: 'La fecha no es válida.' }, { status: 400 });
  }

  const cabeceras = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  const suya = await fetch(
    `${url}/rest/v1/evaluaciones?id=eq.${id}&select=persona_id,fecha_entrevista`,
    { headers: cabeceras, cache: 'no-store' }
  );
  const fila = (await suya.json().catch(() => []))[0] as
    | { persona_id: string; fecha_entrevista: string | null }
    | undefined;
  if (!fila) return NextResponse.json({ ok: false, motivo: 'No existe.' }, { status: 404 });

  const edad = nacimiento ? edadA(nacimiento, fila.fecha_entrevista) : null;
  if (nacimiento && edad === null) {
    return NextResponse.json(
      { ok: false, motivo: 'Esa fecha da una edad imposible: revisá el año.' },
      { status: 400 }
    );
  }

  const persona = await fetch(`${url}/rest/v1/personas?id=eq.${fila.persona_id}`, {
    method: 'PATCH',
    headers: cabeceras,
    body: JSON.stringify({ fecha_nacimiento: nacimiento || null }),
    cache: 'no-store',
  });
  if (!persona.ok) {
    return NextResponse.json({ ok: false, motivo: `Supabase ${persona.status}.` }, { status: 400 });
  }

  const evaluacion = await fetch(`${url}/rest/v1/evaluaciones?id=eq.${id}`, {
    method: 'PATCH',
    headers: cabeceras,
    body: JSON.stringify({ edad }),
    cache: 'no-store',
  });
  if (!evaluacion.ok) {
    return NextResponse.json(
      { ok: false, motivo: `Supabase ${evaluacion.status}.` },
      { status: 400 }
    );
  }

  const yo = await quienSoy();
  await anotarAcceso({
    quien: yo.nombre,
    accion: 'escritura',
    recurso: 'evaluacion',
    recursoId: id,
    detalle: { nacimiento: nacimiento || null, edad },
  });
  revalidateTag(CACHE_PSICOTECNICOS);
  return NextResponse.json({ ok: true, edad });
}
