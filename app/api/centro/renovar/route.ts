import { NextResponse } from 'next/server';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El inquilino contesta si renueva sus horas para el mes que viene.
 *
 * El mes no viene del navegador: es siempre el que sigue al de hoy. Tampoco la
 * persona: es la de la cookie firmada.
 */
export async function POST(req: Request) {
  const yo = await inquilinoDeLaSesion();
  if (!yo) return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });

  const datos = await req.json().catch(() => null);
  const respuesta = String(datos?.respuesta ?? '') as Respuesta;
  if (!['si', 'no', 'cambiar'].includes(respuesta)) return mal('Respuesta inválida.');
  const nota = String(datos?.nota ?? '').trim().slice(0, 600) || null;
  if (respuesta === 'cambiar' && !nota) return mal('Contanos qué horas querés cambiar.');

  const hoy = hoyISO();
  const periodo = mesCorrido(periodoDe(hoy), 1);

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

  await responderRenovacion(yo.id, periodo, respuesta, nota, validos);
  return NextResponse.json({ ok: true });
}

function mal(motivo: string) {
  return NextResponse.json({ ok: false, motivo }, { status: 400 });
}
