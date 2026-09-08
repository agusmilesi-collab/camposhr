import { NextResponse } from 'next/server';
import { inquilinoDeLaSesion, legajoAlDia } from '@/lib/centro-sesion';
import { crearReserva } from '@/lib/consultorios-escritura';
import {
  aperturas as leerAperturas,
  cierresEntre,
  hora,
  hoyISO,
  listarEspacios,
  reservasEntre,
} from '@/lib/consultorios';
import { anotarAcceso } from '@/lib/accesos';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

/**
 * La reserva que hace el propio inquilino.
 *
 * **A nombre de quién va no lo dice el navegador**: sale de la cookie firmada.
 * Si viniera en el cuerpo, cualquiera podría reservar a costa de otro.
 *
 * Tres cosas se comprueban antes de escribir, y las tres son del documento de
 * convivencia: que el legajo esté al día, que la sala esté abierta a esa hora, y
 * que no haya un cierre encima. El solapamiento con otra reserva lo impide la
 * base, que es lo único que aguanta dos clics a la vez.
 */
export async function POST(req: Request) {
  const yo = await inquilinoDeLaSesion();
  if (!yo) return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });

  const hoy = hoyISO();
  if (!legajoAlDia(yo, hoy)) {
    return NextResponse.json(
      {
        ok: false,
        motivo: 'Falta tu matrícula vigente en el legajo. Avisale a Lorena o a Lucila y lo cargan.',
      },
      { status: 403 }
    );
  }
  if (!yo.normas_aceptadas_at) {
    return NextResponse.json(
      { ok: false, motivo: 'Falta aceptar las normas de convivencia.' },
      { status: 403 }
    );
  }

  const datos = await req.json().catch(() => null);
  const espacioId = String(datos?.espacioId ?? '');
  const fecha = String(datos?.fecha ?? '');
  const desdeHora = String(datos?.desdeHora ?? '');
  const hastaHora = String(datos?.hastaHora ?? '');
  if (!UUID.test(espacioId)) return mal('Sala inválida.');
  if (!FECHA.test(fecha)) return mal('Falta la fecha.');
  if (!HORA.test(desdeHora) || !HORA.test(hastaHora)) return mal('Las horas van como 08:00.');
  if (hastaHora <= desdeHora) return mal('La hora de fin va después de la de inicio.');
  // Nadie reserva para atrás: la hora ya pasó y el cargo saldría igual.
  if (fecha < hoy) return mal('Esa fecha ya pasó.');

  const [espacios, aperturas, cierres, reservas] = await Promise.all([
    listarEspacios(),
    leerAperturas(),
    cierresEntre(fecha, fecha),
    reservasEntre(fecha, fecha),
  ]);
  const espacio = espacios.find((e) => e.id === espacioId);
  if (!espacio || !espacio.activo) return mal('Esa sala no está disponible.');

  // Lunes es 0 y el domingo queda en 6, que ninguna sala tiene cargado.
  const diaSemana = (new Date(`${fecha}T12:00:00-03:00`).getDay() + 6) % 7;
  const apertura = aperturas.find((a) => a.espacio_id === espacioId && a.dia_semana === diaSemana);
  if (!apertura) return mal('Ese día el Centro no abre.');
  if (hora(desdeHora) < hora(apertura.desde_hora) || hora(hastaHora) > hora(apertura.hasta_hora)) {
    return mal(`Ese día se puede de ${apertura.desde_hora.slice(0, 5)} a ${apertura.hasta_hora.slice(0, 5)}.`);
  }

  const chocaConCierre = cierres.some(
    (c) =>
      (c.espacio_id === null || c.espacio_id === espacioId) &&
      (c.desde_hora === null ||
        (hora(desdeHora) < hora(c.hasta_hora as string) && hora(hastaHora) > hora(c.desde_hora)))
  );
  if (chocaConCierre) return mal('Esa franja está cerrada.');

  const chocaConReserva = reservas.some(
    (r) =>
      r.espacio_id === espacioId &&
      hora(desdeHora) < hora(r.hasta_hora) &&
      hora(hastaHora) > hora(r.desde_hora)
  );
  if (chocaConReserva) return mal('Esa hora ya está reservada.');

  const r = await crearReserva({
    espacioId,
    inquilinoId: yo.id,
    fecha,
    desdeHora,
    hastaHora,
    quien: yo.nombre,
  });
  if (!r.ok) return mal(r.motivo);

  await anotarAcceso({
    accion: 'escritura',
    recurso: 'reserva',
    detalle: { espacio: espacio.nombre, fecha, desdeHora, hastaHora },
    quien: yo.nombre,
  });
  return NextResponse.json({ ok: true });
}

function mal(motivo: string) {
  return NextResponse.json({ ok: false, motivo }, { status: 400 });
}
