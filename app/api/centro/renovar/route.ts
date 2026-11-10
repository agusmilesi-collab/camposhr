import { NextResponse } from 'next/server';
import { inquilinoQueEscribe } from '@/lib/centro-sesion';
import {
  contratos as leerContratos,
  diaSemanaDe,
  finDeMes,
  hoyISO,
  mesCorrido,
  periodoDe,
} from '@/lib/consultorios';
import { feriadosEntre } from '@/lib/feriados';
import { responderRenovacion, type Respuesta } from '@/lib/renovaciones';
import { mesesAbiertosDesde } from '@/lib/apertura-mes';
import { hora } from '@/lib/consultorios-calculo';

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
  if (!['si', 'no', 'cambiar'].includes(respuesta)) return mal('Respuesta inválida.');
  const nota = String(datos?.nota ?? '').trim().slice(0, 600) || null;

  const hoy = hoyISO();
  const periodo = mesCorrido(periodoDe(hoy), 1);
  // Abierto el mes, las reservas y los cargos ya salieron de lo contestado.
  if ((await mesesAbiertosDesde(periodo)).includes(periodo)) {
    return mal('Ese mes ya está abierto. Para cambiar algo, escribile a Lucila.');
  }

  // Los feriados que tildó, contra lo que de verdad puede tildar: un feriado
  // de ese mes que cae en un día en que tiene horas fijas. Lo demás se descarta
  // sin avisar, que solo llega si alguien armó el pedido a mano.
  const pedidos: string[] = Array.isArray(datos?.feriados) ? datos.feriados.map(String) : [];
  const [feriados, contratos] = await Promise.all([
    feriadosEntre(periodo, finDeMes(periodo)),
    leerContratos(),
  ]);
  const susDias = new Set(
    contratos
      .filter((c) => c.inquilino_id === yo.id && (c.vigente_hasta === null || c.vigente_hasta >= periodo))
      .map((c) => c.dia_semana)
  );
  const validos = feriados
    .map((f) => f.fecha)
    .filter((f) => pedidos.includes(f) && susDias.has(diaSemanaDe(f)));

  // Las horas que deja, contra sus bandas de ese mes: una hora que no es suya
  // o que cae fuera de la banda se descarta.
  const pedidasDeja: { contrato: string; hora: number }[] = Array.isArray(datos?.deja)
    ? datos.deja.map((d: { contrato?: unknown; hora?: unknown }) => ({
        contrato: String(d?.contrato ?? ''),
        hora: Number(d?.hora),
      }))
    : [];
  const deja = pedidasDeja.filter((d, n) => {
    const c = contratos.find(
      (x) => x.id === d.contrato && x.inquilino_id === yo.id && (x.vigente_hasta === null || x.vigente_hasta >= periodo)
    );
    const repetida = pedidasDeja.findIndex((o) => o.contrato === d.contrato && o.hora === d.hora) !== n;
    return c && !repetida && Number.isInteger(d.hora) && d.hora >= hora(c.desde_hora) && d.hora < hora(c.hasta_hora);
  });
  if (respuesta === 'cambiar' && !nota && deja.length === 0) {
    return mal('Marcá las horas que dejás o contanos cuáles querés sumar.');
  }

  await responderRenovacion(yo.id, periodo, respuesta, nota, validos, deja);
  return NextResponse.json({ ok: true });
}

function mal(motivo: string) {
  return NextResponse.json({ ok: false, motivo }, { status: 400 });
}
