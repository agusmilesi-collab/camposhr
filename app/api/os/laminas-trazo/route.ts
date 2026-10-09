import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { select } from '@/lib/supabase';
import { esTestConLaminas } from '@/lib/laminas';
import type { Senal } from '@/lib/laminas-trazo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lo que la persona evaluada está señalando ahora, para la pantalla de
 * codificación. La edad de cada punto ya viene sumada con lo que tardó en
 * llegar hasta acá, así la pantalla lo borra a tiempo.
 */
export async function GET(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }
  const url = new URL(req.url);
  const id = url.searchParams.get('evaluacion') ?? '';
  const test = url.searchParams.get('test') ?? '';
  if (!UUID.test(id) || !esTestConLaminas(test)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const filas = await select<{ trazo: (Senal & { at: number }) | null }>(
      'laminas_enlaces',
      `select=trazo&evaluacion_id=eq.${id}&test=eq.${test}` +
        `&vence_at=gt.${new Date().toISOString()}&trazo=not.is.null&order=vence_at.desc&limit=1`,
    );
    const t = filas[0]?.trazo;
    if (!t)
      return NextResponse.json(
        { ok: true, senal: null },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    const viaje = Math.max(0, Date.now() - t.at);
    const senal: Senal = {
      lamina: t.lamina,
      trazos: t.trazos.map((tr) => tr.map(([x, y, e]) => [x, y, e + viaje])),
    };
    return NextResponse.json({ ok: true, senal }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('laminas-trazo:', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
