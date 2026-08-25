import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';

export const runtime = 'nodejs';

/**
 * En qué orden se le toman los tests a esta persona.
 *
 * Solo nombres de tests, sin repetir: lo que llega se guarda tal cual y la hoja
 * de la entrevista ordena por eso, dejando al final lo que no esté en la lista.
 * Por eso un nombre inventado no rompe nada, pero tampoco tiene por qué entrar.
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
  const id = datos?.evaluacionId;
  const orden = datos?.orden;
  if (typeof id !== 'string' || !UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Evaluación inválida.' }, { status: 400 });
  }
  if (
    !Array.isArray(orden) ||
    orden.length > 20 ||
    !orden.every((t) => typeof t === 'string' && t.length > 0 && t.length <= 80) ||
    new Set(orden).size !== orden.length
  ) {
    return NextResponse.json(
      { ok: false, motivo: 'El orden tiene que ser una lista de tests sin repetir.' },
      { status: 400 }
    );
  }

  const res = await fetch(`${url}/rest/v1/evaluaciones?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ orden_tests: orden.length ? orden : null }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, motivo: `Supabase respondió ${res.status}.` },
      { status: 400 }
    );
  }

  revalidateTag(CACHE_PSICOTECNICOS);
  return NextResponse.json({ ok: true });
}
