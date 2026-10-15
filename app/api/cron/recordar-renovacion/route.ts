import { NextResponse } from 'next/server';
import { contratos as leerContratos, listarInquilinos } from '@/lib/consultorios';
import { horasSemanalesTotales, hoyISO, mesCorrido, mesLargo, periodoDe } from '@/lib/consultorios-calculo';
import { hayCorreo } from '@/lib/correo';
import { enviarRecordatorioRenovacion } from '@/lib/correo-centro';
import { DIRECCION } from '@/lib/direccion';
import { renovacionesDe } from '@/lib/renovaciones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El recordatorio de renovar, el día 28 de cada mes.
 *
 * Lo dispara el cron de Vercel (`vercel.json`), que llega con
 * `Authorization: Bearer <CRON_SECRET>`. Sin la variable cargada, o con otro
 * valor, no hace nada: la ruta falla cerrada, como el resto del Centro.
 *
 * Le escribe a quien tiene horas fijas, correo cargado y no contestó todavía
 * sobre el mes que viene. Quien contestó, lo que sea, no recibe nada. La clave
 * de idempotencia lleva el mes y el inquilino, así correrlo dos veces el mismo
 * día no manda dos correos.
 *
 * Con `?dia=2026-10-28` se finge la fecha, solo fuera de producción. Con
 * `?simular=1` cuenta a quién le escribiría y no manda nada, en cualquier
 * entorno: sirve para mirar la lista antes del 28.
 */
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  if (!secreto || auth !== `Bearer ${secreto}`) {
    return NextResponse.json({ ok: false, motivo: 'No autorizado.' }, { status: 401 });
  }
  if (!hayCorreo()) {
    return NextResponse.json({ ok: false, motivo: 'El envío de correo no está configurado.' }, { status: 503 });
  }

  const url = new URL(req.url);
  const fingido = url.searchParams.get('dia');
  const hoy =
    process.env.NODE_ENV !== 'production' && fingido && /^\d{4}-\d{2}-\d{2}$/.test(fingido)
      ? fingido
      : hoyISO();
  const proximo = mesCorrido(periodoDe(hoy), 1);

  const [inquilinos, contratos, renovaciones] = await Promise.all([
    listarInquilinos(),
    leerContratos(),
    renovacionesDe(proximo),
  ]);

  const pendientes = inquilinos.filter(
    (i) =>
      i.activo &&
      i.correo &&
      DIRECCION.test(i.correo) &&
      !renovaciones[i.id] &&
      horasSemanalesTotales(contratos, i.id, hoy) > 0
  );

  const mes = mesLargo(proximo);
  if (url.searchParams.get('simular') === '1') {
    return NextResponse.json({
      ok: true,
      simulado: true,
      mes: proximo,
      pendientes: pendientes.map((i) => ({ id: i.id, nombre: i.nombre })),
    });
  }
  const resultados = await Promise.all(
    pendientes.map(async (i) => {
      const r = await enviarRecordatorioRenovacion({
        correo: i.correo as string,
        nombre: i.nombre,
        mes,
        periodo: proximo,
        inquilinoId: i.id,
      });
      return { id: i.id, ok: r.ok, motivo: r.ok ? undefined : r.motivo };
    })
  );

  const mandados = resultados.filter((r) => r.ok).length;
  console.log(`[cron] recordatorio de renovar ${proximo}: ${mandados} de ${pendientes.length} mandados`);
  return NextResponse.json({ ok: true, mes: proximo, pendientes: pendientes.length, mandados, resultados });
}
