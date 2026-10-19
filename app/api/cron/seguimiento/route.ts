import { NextResponse } from 'next/server';
import { hayCorreo } from '@/lib/correo';
import { hoy } from '@/lib/hora';
import { porRecordar, preguntar, vencidos } from '@/lib/seguimiento';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El seguimiento a los noventa días, todos los días a las diez de la mañana.
 *
 * Lo dispara el cron de Vercel (`vercel.json`), que llega con
 * `Authorization: Bearer <CRON_SECRET>`. Sin la variable cargada, o con otro
 * valor, no hace nada.
 *
 * Toma a quienes ingresaron, cumplen noventa días hoy o antes y todavía no se
 * les preguntó, y le escribe a quien pidió la búsqueda (`lib/seguimiento.ts`).
 * El que ya salió no vuelve a salir; el que no tuvo a quién mandarse se vuelve
 * a intentar mañana. A los siete días del primero, si nadie contestó, sale un
 * recordatorio, uno solo.
 *
 * Con `?dia=2026-12-01` se finge la fecha, solo fuera de producción. Con
 * `?simular=1` dice a quiénes les tocaría y no manda nada, en cualquier
 * entorno.
 */
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  if (!secreto || auth !== `Bearer ${secreto}`) {
    return NextResponse.json({ ok: false, motivo: 'No autorizado.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const fingido = url.searchParams.get('dia');
  const dia =
    process.env.NODE_ENV !== 'production' && fingido && /^\d{4}-\d{2}-\d{2}$/.test(fingido) ? fingido : hoy();

  const [lista, recordar] = await Promise.all([
    vencidos(dia),
    porRecordar(fingido && dia !== hoy() ? new Date(`${dia}T12:00:00-03:00`) : new Date()),
  ]);
  const resumen = (e: (typeof lista)[number]) => ({
    id: e.id,
    persona: e.personas?.nombre ?? null,
    empresa: e.pedidos?.empresas?.nombre ?? null,
    desde: e.fecha_ingreso_empresa,
  });
  if (url.searchParams.get('simular') === '1') {
    return NextResponse.json({
      ok: true,
      simulado: true,
      dia,
      vencidos: lista.map(resumen),
      recordatorios: recordar.map(resumen),
    });
  }
  if (!hayCorreo()) {
    return NextResponse.json({ ok: false, motivo: 'El envío de correo no está configurado.' }, { status: 503 });
  }

  // De a uno: son pocos por día y así un rechazo no frena a los demás.
  const resultados = [];
  for (const e of lista) {
    const r = await preguntar(e).catch((err) => ({ estado: 'falló' as const, motivo: String(err) }));
    resultados.push({ id: e.id, ...r });
  }
  const recordatorios = [];
  for (const e of recordar) {
    const r = await preguntar(e, true).catch((err) => ({ estado: 'falló' as const, motivo: String(err) }));
    recordatorios.push({ id: e.id, ...r });
  }
  return NextResponse.json({ ok: true, dia, resultados, recordatorios });
}
