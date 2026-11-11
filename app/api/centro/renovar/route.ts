import { NextResponse } from 'next/server';
import { inquilinoQueEscribe } from '@/lib/centro-sesion';
import { contratos as leerContratos, hoyISO, mesCorrido, periodoDe } from '@/lib/consultorios';
import { responderRenovacion, type Respuesta } from '@/lib/renovaciones';
import { mesesAbiertosDesde } from '@/lib/apertura-mes';
import { cambiosValidos, puedeRenovar } from '@/lib/bandas-inquilino';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El inquilino contesta si renueva sus horas para el mes que viene.
 *
 * El mes no viene del navegador: es siempre el que sigue al de hoy. Tampoco la
 * persona: es la de la cookie firmada.
 */
export async function POST(req: Request) {
  const sesion = await inquilinoQueEscribe();
  if ('error' in sesion) {
    return NextResponse.json({ ok: false, motivo: sesion.error.motivo }, { status: sesion.error.status });
  }
  const yo = sesion.yo;

  const datos = await req.json().catch(() => null);
  const respuesta = String(datos?.respuesta ?? '') as Respuesta;
  // Sin "no": quien no renueva el mes se lo avisa a Lucila por WhatsApp
  // (decisión de Agustín, 10/11/2026), y la pantalla ya no lo ofrece.
  if (!['si', 'cambiar'].includes(respuesta)) return mal('Respuesta inválida.');
  const nota = String(datos?.nota ?? '').trim().slice(0, 600) || null;

  const hoy = hoyISO();
  const periodo = mesCorrido(periodoDe(hoy), 1);
  // Abierto el mes, las reservas y los cargos ya salieron de lo contestado.
  if ((await mesesAbiertosDesde(periodo)).includes(periodo)) {
    return mal('Ese mes ya está abierto. Para cambiar algo, escribile a Lucila.');
  }
  if (!puedeRenovar(await leerContratos(), yo.id, hoy, periodo)) {
    return mal('La renovación se contesta desde el 25, y solo con horas fijas.');
  }

  // Lo marcado, contra lo que de verdad puede marcar (`cambiosValidos`).
  const { feriados: validos, deja, sumo } = await cambiosValidos(yo.id, periodo, {
    feriados: datos?.feriados,
    deja: datos?.deja,
  });
  if (respuesta === 'cambiar' && !nota && deja.length === 0 && !sumo) {
    return mal('Marcá las horas que no renovás o sumá horas fijas.');
  }

  await responderRenovacion(yo.id, periodo, respuesta, nota, validos, deja);
  return NextResponse.json({ ok: true });
}

function mal(motivo: string) {
  return NextResponse.json({ ok: false, motivo }, { status: 400 });
}
