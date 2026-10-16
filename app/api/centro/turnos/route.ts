import { NextResponse } from 'next/server';
import { inquilinoQueEscribe } from '@/lib/centro-sesion';
import {
  contratos as leerContratos,
  finDeMes,
  hora,
  horasPrevistas,
  hoyISO,
  mesCorrido,
  MESES_PREVISTOS,
  periodoDe,
  reservasDe,
} from '@/lib/consultorios';
import { feriadosEntre } from '@/lib/feriados';
import { borrarTurno, guardarTurno, marcarAsistencia, marcarPago } from '@/lib/turnos';
import { nombreCompleto, pacientesDe } from '@/lib/pacientes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El inquilino anota a quién atiende en una hora reservada, o lo borra.
 *
 * La hora tiene que caer adentro de una reserva activa suya de ese día: un
 * turno fuera de sus horas no existe, porque no tiene sala. La persona es la
 * de la cookie firmada, nunca la del pedido.
 */
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function mal(motivo: string, status = 400) {
  return NextResponse.json({ ok: false, motivo }, { status });
}

async function validar(req: Request, exigeReserva = true) {
  const sesion = await inquilinoQueEscribe();
  if ('error' in sesion) return { error: mal(sesion.error.motivo, sesion.error.status) };
  const yo = sesion.yo;
  const datos = await req.json().catch(() => null);
  const fecha = String(datos?.fecha ?? '');
  const h = Number(datos?.hora);
  if (!FECHA.test(fecha) || !Number.isInteger(h) || h < 0 || h > 23) return { error: mal('Hora inválida.') };
  const reservas = await reservasDe(yo.id);
  let adentro = reservas.some(
    (r) => r.fecha === fecha && hora(r.desde_hora) <= h && h < hora(r.hasta_hora)
  );
  // En un mes que viene todavía no hay reservas: vale la hora fija prevista
  // por el contrato, hasta tres meses adelante.
  const hoy = hoyISO();
  const primerMesPrevisto = mesCorrido(periodoDe(hoy), 1);
  const tope = finDeMes(mesCorrido(periodoDe(hoy), MESES_PREVISTOS));
  if (!adentro && fecha >= primerMesPrevisto && fecha <= tope) {
    const [contratos, feriados] = await Promise.all([leerContratos(), feriadosEntre(fecha, fecha)]);
    adentro = horasPrevistas(contratos, yo.id, fecha, fecha, feriados.map((f) => f.fecha)).some(
      (p) => hora(p.desde_hora) <= h && h < hora(p.hasta_hora)
    );
  }
  // Borrar vale siempre: un turno sobre una hora que ya no está reservada
  // (huérfano) tiene que poder sacarse.
  if (!adentro && exigeReserva) return { error: mal('Esa hora no está reservada a tu nombre.') };
  return { yo, datos, fecha, h };
}

export async function POST(req: Request) {
  const v = await validar(req);
  if ('error' in v) return v.error;
  const paciente = String(v.datos?.paciente ?? '').trim().slice(0, 120);
  if (!paciente) return mal('Escribí el nombre de quien atendés.');
  const nota = String(v.datos?.nota ?? '').trim().slice(0, 300) || null;
  // Si el nombre escrito es el de una ficha ("Apellido, Nombre" o "Nombre
  // Apellido", sin distinguir mayúsculas), el turno queda atado a ella.
  const clave = paciente.toLowerCase().replace(/\s+/g, ' ');
  const ficha = (await pacientesDe(v.yo.id)).find((f) => {
    const a = nombreCompleto(f).toLowerCase();
    const b = `${f.nombre} ${f.apellido}`.trim().toLowerCase();
    return clave === a || clave === b;
  });
  const turno = await guardarTurno({
    inquilinoId: v.yo.id,
    fecha: v.fecha,
    hora: v.h,
    paciente,
    nota,
    pacienteId: ficha?.id ?? null,
  });
  return NextResponse.json({ ok: true, turno });
}

export async function DELETE(req: Request) {
  const v = await validar(req, false);
  if ('error' in v) return v.error;
  await borrarTurno(v.yo.id, v.fecha, v.h);
  return NextResponse.json({ ok: true });
}

/** Si el paciente vino: true, false, o null para desmarcar. */
export async function PATCH(req: Request) {
  const sesion = await inquilinoQueEscribe();
  if ('error' in sesion) return mal(sesion.error.motivo, sesion.error.status);
  const datos = await req.json().catch(() => null);
  const id = String(datos?.id ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return mal('Turno inválido.');
  // Dos cosas distintas por el mismo camino: si vino (desde Inicio) o si
  // pagó (desde la cuenta del paciente). Viene una u otra.
  if (typeof datos?.pagado === 'boolean') {
    const importe = Number(datos?.importe);
    await marcarPago(sesion.yo.id, id, datos.pagado, Number.isFinite(importe) && importe >= 0 ? importe : null);
    return NextResponse.json({ ok: true });
  }
  const asistio = datos?.asistio === true ? true : datos?.asistio === false ? false : null;
  await marcarAsistencia(sesion.yo.id, id, asistio);
  return NextResponse.json({ ok: true });
}
