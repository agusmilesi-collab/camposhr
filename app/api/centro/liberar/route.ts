import { NextResponse } from 'next/server';
import { inquilinoQueEscribe } from '@/lib/centro-sesion';
import {
  deshacerReserva,
  HORAS_PARA_SOLTAR,
  HORAS_LIBERABLES,
  MINUTOS_PARA_DESHACER,
  horasSoltadasEn,
  liberarReserva,
} from '@/lib/consultorios-escritura';
import { hora, periodoDe } from '@/lib/consultorios';
import { horasHastaQueEmpiece } from '@/lib/consultorios-calculo';
import { select } from '@/lib/supabase';
import { anotarAcceso } from '@/lib/accesos';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Soltar una hora suelta propia.
 *
 * **Las horas fijas del mes no se cancelan** (decisión de Agustín, 10/11/2026):
 * la banda se alquila entera. Solo se suelta una hora suelta, hasta
 * veinticuatro horas antes de que empiece y hasta dos horas por mes. Soltada a
 * tiempo no se cobra: el cargo queda anulado en el mismo mes con un renglón
 * que lo compensa (no se borra, porque puede estar en una factura), y si ya
 * estaba pagada Lucila devuelve la plata y la registra en la ficha.
 *
 * Fuera de eso no se suelta desde acá: lo resuelven las propietarias, que
 * pueden liberar desde el calendario.
 */
export async function POST(req: Request) {
  const sesion = await inquilinoQueEscribe();
  if ('error' in sesion) {
    return NextResponse.json({ ok: false, motivo: sesion.error.motivo }, { status: sesion.error.status });
  }
  const yo = sesion.yo;

  const datos = await req.json().catch(() => null);
  const id = String(datos?.id ?? '');
  if (!UUID.test(id)) return mal('Reserva inválida.');

  const filas = await select<{
    id: string;
    inquilino_id: string;
    fecha: string;
    desde_hora: string;
    hasta_hora: string;
    estado: string;
    origen: string;
    created_at: string;
  }>(
    'reservas',
    `select=id,inquilino_id,fecha,desde_hora,hasta_hora,estado,origen,created_at&id=eq.${id}`
  );
  const reserva = filas[0];
  // La reserva de otro no existe para quien pregunta: contestar distinto diría
  // que esa hora es de alguien.
  if (!reserva || reserva.inquilino_id !== yo.id) return mal('Esa reserva no existe.');
  if (reserva.estado !== 'activa') return mal('Esa reserva ya no está activa.');
  // Antes que el deshacer: una hora fija la genera el sistema al abrir el mes,
  // y en los quince minutos siguientes pasaría por recién hecha.
  if (reserva.origen === 'contrato') {
    return mal('Las horas fijas del mes no se cancelan. Si necesitás algo, escribile a Lucila.');
  }

  /*
   * El deshacer, antes que todo lo demás.
   *
   * Una reserva de hace un minuto es un error, no una hora que se devuelve: no
   * mira la fecha, no cuenta contra el tope del mes y se lleva el cargo, porque
   * no hubo alquiler que compensar.
   */
  const minutos = (Date.now() - new Date(reserva.created_at).getTime()) / 60000;
  if (minutos <= MINUTOS_PARA_DESHACER) {
    await deshacerReserva(id);
    await anotarAcceso({
      accion: 'escritura',
      recurso: 'reserva',
      recursoId: id,
      detalle: { accion: 'deshacer' },
      quien: yo.nombre,
    });
    return NextResponse.json({ ok: true, deshecha: true });
  }

  if (horasHastaQueEmpiece(reserva.fecha, reserva.desde_hora) < HORAS_PARA_SOLTAR) {
    return mal(
      `Una hora suelta se puede soltar hasta ${HORAS_PARA_SOLTAR} horas antes de que empiece. ` +
        'Escribile a Lucila para ver qué se puede hacer.'
    );
  }

  const periodo = periodoDe(reserva.fecha);
  const yaSoltadas = await horasSoltadasEn(yo.id, periodo);
  const estas = hora(reserva.hasta_hora) - hora(reserva.desde_hora);
  if (yaSoltadas + estas > HORAS_LIBERABLES) {
    // Dos motivos distintos con el mismo tope, y el mensaje tiene que decir
    // cuál es: "ya soltaste 0 horas" no explica nada a quien intenta soltar una
    // banda de cuatro, que es el caso más común.
    return mal(
      yaSoltadas === 0
        ? `Esta reserva es de ${estas} horas y el tope es ${HORAS_LIBERABLES} por mes. Escribile a Lucila.`
        : `Este mes ya soltaste ${yaSoltadas} ${yaSoltadas === 1 ? 'hora' : 'horas'}, y el tope es ${HORAS_LIBERABLES} por mes.`
    );
  }

  await liberarReserva(id, true, 'Hora suelta soltada a tiempo: no se cobra', yo.nombre);
  await anotarAcceso({
    accion: 'escritura',
    recurso: 'reserva',
    recursoId: id,
    detalle: { accion: 'liberar' },
    quien: yo.nombre,
  });
  return NextResponse.json({ ok: true });
}

function mal(motivo: string) {
  return NextResponse.json({ ok: false, motivo }, { status: 400 });
}
