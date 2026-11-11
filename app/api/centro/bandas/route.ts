import { NextResponse } from 'next/server';
import { inquilinoQueEscribe } from '@/lib/centro-sesion';
import { contratos as leerContratos, hoyISO, mesCorrido, periodoDe } from '@/lib/consultorios';
import { puedeRenovar, quitarBanda, sumarBanda } from '@/lib/bandas-inquilino';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El inquilino suma o quita horas fijas para el mes que viene
 * (`lib/bandas-inquilino.ts`). El mes no viene del navegador: es siempre el
 * que sigue al de hoy. La persona es la de la cookie firmada.
 */
export async function POST(req: Request) {
  const sesion = await inquilinoQueEscribe();
  if ('error' in sesion) {
    return NextResponse.json({ ok: false, motivo: sesion.error.motivo }, { status: sesion.error.status });
  }
  const yo = sesion.yo;
  const datos = await req.json().catch(() => null);
  const periodo = mesCorrido(periodoDe(hoyISO()), 1);

  if (datos?.accion === 'sumar') {
    const espacioId = String(datos?.espacioId ?? '');
    const dia = Number(datos?.dia);
    const horas: number[] = Array.isArray(datos?.horas) ? datos.horas.map(Number).filter(Number.isInteger) : [];
    if (!UUID.test(espacioId) || !Number.isInteger(dia)) return mal('Elegí día y consultorio.');
    if (!puedeRenovar(await leerContratos(), yo.id, hoyISO(), periodo)) {
      return mal('Las horas fijas se suman al renovar, desde el 25.');
    }
    const r = await sumarBanda(yo.id, periodo, espacioId, dia, horas, {
      feriados: datos?.feriados,
      deja: datos?.deja,
    });
    return r.ok ? NextResponse.json({ ok: true }) : mal(r.motivo);
  }
  if (datos?.accion === 'quitar') {
    const id = String(datos?.id ?? '');
    if (!UUID.test(id)) return mal('Banda inválida.');
    const r = await quitarBanda(yo.id, periodo, id);
    return r.ok ? NextResponse.json({ ok: true }) : mal(r.motivo);
  }
  return mal('Acción desconocida.');
}

function mal(motivo: string) {
  return NextResponse.json({ ok: false, motivo }, { status: 400 });
}
