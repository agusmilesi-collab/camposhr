import { NextResponse } from 'next/server';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import {
  deshacerReserva,
  DIAS_PARA_SOLTAR,
  HORAS_LIBERABLES,
  MINUTOS_PARA_DESHACER,
  horasSoltadasEn,
  liberarReserva,
} from '@/lib/consultorios-escritura';
import { hora, hoyISO, periodoDe, sumarDias } from '@/lib/consultorios';
import { select } from '@/lib/supabase';
import { anotarAcceso } from '@/lib/accesos';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Soltar una hora propia.
 *
 * Lo reservado se paga, así que soltar no borra el cargo: dentro del plazo deja
 * un crédito que descuenta del mes siguiente, y la hora vuelve al calendario
 * para venderse de nuevo.
 *
 * Dos límites: cuarenta y ocho horas de anticipación, que alcanzan para avisar
 * y para intentar revenderla, y dos horas por mes, para que una banda no se
 * desarme de a pedazos.
 *
 * Fuera de plazo no se suelta desde acá: eso lo resuelven las propietarias, que
 * pueden liberar con el motivo escrito.
 */
export async function POST(req: Request) {
  const yo = await inquilinoDeLaSesion();
  if (!yo) return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });

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
    created_at: string;
  }>(
    'reservas',
    `select=id,inquilino_id,fecha,desde_hora,hasta_hora,estado,created_at&id=eq.${id}`
  );
  const reserva = filas[0];
  // La reserva de otro no existe para quien pregunta: contestar distinto diría
  // que esa hora es de alguien.
  if (!reserva || reserva.inquilino_id !== yo.id) return mal('Esa reserva no existe.');
  if (reserva.estado !== 'activa') return mal('Esa reserva ya no está activa.');

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

  const hoy = hoyISO();
  if (reserva.fecha < sumarDias(hoy, DIAS_PARA_SOLTAR)) {
    return mal(
      `Esta hora es del ${reserva.fecha.slice(8, 10)}/${reserva.fecha.slice(5, 7)} y se puede soltar hasta ` +
        `${DIAS_PARA_SOLTAR} días antes. Escribile a Lorena o a Lucila para ver qué se puede hacer.`
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
        ? `Esta reserva es de ${estas} horas y el tope es ${HORAS_LIBERABLES} por mes. Escribile a Lorena o a Lucila.`
        : `Este mes ya soltaste ${yaSoltadas} ${yaSoltadas === 1 ? 'hora' : 'horas'}, y el tope es ${HORAS_LIBERABLES} por mes.`
    );
  }

  await liberarReserva(id, true, 'Hora liberada por el inquilino', yo.nombre);
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
