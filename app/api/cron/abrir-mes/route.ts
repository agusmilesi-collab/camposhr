import { NextResponse } from 'next/server';
import { hoyISO, mesCorrido, periodoDe } from '@/lib/consultorios-calculo';
import { abrirSiToca, planDelMes } from '@/lib/apertura-mes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * La apertura del mes del Centro, todos los días a las diez de la mañana.
 *
 * Lo dispara el cron de Vercel (`vercel.json`), que llega con
 * `Authorization: Bearer <CRON_SECRET>`. Sin la variable cargada, o con otro
 * valor, no hace nada.
 *
 * Casi todos los días no hay nada que hacer. El último día del mes abre el que
 * sigue, y si el mes en curso quedó sin abrir lo abre (`abrirSiToca`): así un
 * día que el cron no corre se recupera al siguiente.
 *
 * Con `?dia=2026-11-30` se finge la fecha, solo fuera de producción. Con
 * `?simular=1` dice qué generaría para el mes que viene y no escribe nada, en
 * cualquier entorno.
 */
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  if (!secreto || auth !== `Bearer ${secreto}`) {
    return NextResponse.json({ ok: false, motivo: 'No autorizado.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const fingido = url.searchParams.get('dia');
  const hoy =
    process.env.NODE_ENV !== 'production' && fingido && /^\d{4}-\d{2}-\d{2}$/.test(fingido)
      ? fingido
      : hoyISO();

  if (url.searchParams.get('simular')) {
    const plan = await planDelMes(mesCorrido(periodoDe(hoy), 1));
    return NextResponse.json({
      ok: true,
      simulado: true,
      periodo: plan.periodo,
      abierto: plan.abierto,
      reservas: plan.filas.length,
      importe: plan.filas.reduce((n, f) => n + (f.importe ?? 0), 0),
      choques: plan.choques,
      inquilinos: plan.inquilinos,
    });
  }

  const abiertos = await abrirSiToca(hoy);
  return NextResponse.json({ ok: true, hoy, abiertos });
}
