import { NextResponse } from 'next/server';
import { inquilinoQueEscribe } from '@/lib/centro-sesion';
import { upsert } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CLAVE = /^[fp]-[0-9a-f-]{36}$/i;

/**
 * El inquilino da por visto un aviso de Inicio (la factura emitida o el pago
 * registrado) con el botón "Ok", y la tarjeta deja de salir antes de los siete
 * días. Lo que se guarda es solo la clave de la tarjeta: el papel sigue en Mi
 * cuenta. Desde el OS, en modo mirando, no escribe.
 */
export async function POST(req: Request) {
  const sesion = await inquilinoQueEscribe();
  if ('error' in sesion) {
    return NextResponse.json({ ok: false, motivo: sesion.error.motivo }, { status: sesion.error.status });
  }
  const { clave } = (await req.json().catch(() => ({}))) as { clave?: unknown };
  if (typeof clave !== 'string' || !CLAVE.test(clave)) {
    return NextResponse.json({ ok: false, motivo: 'Aviso desconocido.' }, { status: 400 });
  }
  await upsert(
    'centro_avisos_vistos',
    { inquilino_id: sesion.yo.id, clave: clave.toLowerCase() },
    'inquilino_id,clave',
    false
  );
  return NextResponse.json({ ok: true });
}
