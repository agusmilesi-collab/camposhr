import { NextResponse } from 'next/server';
import { patch } from '@/lib/supabase';
import { esTestConLaminas, TESTS } from '@/lib/laminas';
import { testDelToken } from '@/lib/laminas-enlace';
import { trazoValido } from '@/lib/laminas-trazo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lo que la persona evaluada tiene dibujado sobre la lámina, para que lo vea
 * la evaluadora en la pantalla de codificación.
 *
 * Lo manda su pantalla mientras dibuja, y una vez más vacío cuando el último
 * trazo se borró. Pisa lo anterior: lo que se guarda es lo que está a la vista.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const test = await testDelToken(params.token);
  if (!test || !esTestConLaminas(test)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const datos = await req.json().catch(() => null);
  const trazo = trazoValido(datos, TESTS[test].laminas);
  if (!trazo) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    await patch('laminas_enlaces', `token=eq.${params.token}`, {
      trazo: { ...trazo, at: Date.now() },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('laminas trazo:', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
