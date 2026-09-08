/**
 * Reservar y liberar, de los dos lados.
 *
 * El OS y la zona del inquilino escriben lo mismo, así que la cuenta del
 * importe y el cargo viven acá y no en cada ruta: dos copias de esta lógica se
 * separan al primer cambio de precio, y entonces lo que cobra una pantalla deja
 * de ser lo que cobra la otra.
 */

import 'server-only';

import { insert, patch, select } from '@/lib/supabase';
import { DIAS_PARA_SOLTAR, HORAS_LIBERABLES, MINUTOS_PARA_DESHACER } from '@/lib/consultorios-calculo';
import {
  contratos as leerContratos,
  escalaVigente,
  hora,
  horasSemanalesTotales,
  listarEspacios,
  periodoDe,
} from '@/lib/consultorios';

export type Pedido = {
  espacioId: string;
  inquilinoId: string;
  fecha: string;
  desdeHora: string;
  hastaHora: string;
  origen?: 'contrato' | 'suelta';
  quien: string;
};

/* Los dos límites de soltar viven en el módulo de cálculo: la pantalla del
   inquilino los muestra y este módulo los hace cumplir, y con la constante acá
   (que lleva `server-only`) el navegador no podía leerlos. */
export { DIAS_PARA_SOLTAR, HORAS_LIBERABLES, MINUTOS_PARA_DESHACER } from '@/lib/consultorios-calculo';

/**
 * Crea la reserva y su cargo.
 *
 * El precio se congela en el momento: una actualización de la escala no vuelve
 * a tocar lo ya reservado. El tramo sale del volumen que la persona ya tiene
 * contratado y nunca es menor al de esta reserva, así que quien toma cuatro
 * horas sueltas entra en el tramo de cuatro aunque no tenga contrato.
 */
export async function crearReserva(p: Pedido): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const [espacios, escala, contratos] = await Promise.all([
    listarEspacios(),
    escalaVigente(p.fecha),
    leerContratos(),
  ]);
  const espacio = espacios.find((e) => e.id === p.espacioId);
  if (!espacio) return { ok: false, motivo: 'Esa sala no existe.' };

  const horas = hora(p.hastaHora) - hora(p.desdeHora);
  const tramo = Math.max(horasSemanalesTotales(contratos, p.inquilinoId, p.fecha), horas);
  const { cotizar } = await import('@/lib/consultorios-calculo');
  const cotizacion = cotizar(escala.tarifas, espacio.id, tramo);
  const importe = cotizacion ? cotizacion.precioHora * horas : null;

  let reserva: { id: string };
  try {
    reserva = await insert<{ id: string }>('reservas', {
      espacio_id: p.espacioId,
      inquilino_id: p.inquilinoId,
      fecha: p.fecha,
      desde_hora: p.desdeHora,
      hasta_hora: p.hastaHora,
      origen: p.origen ?? 'suelta',
      importe,
    });
  } catch (e) {
    const texto = e instanceof Error ? e.message : '';
    if (texto.includes('reservas_sin_solape')) {
      return { ok: false, motivo: 'Esa hora ya está reservada en esa sala.' };
    }
    throw e;
  }

  // Sin precio no hay cargo: es el caso del SUM mientras su tarifa esté sin
  // definir. La reserva vale igual, porque ocupa la sala.
  if (importe !== null) {
    await insert('movimientos', {
      inquilino_id: p.inquilinoId,
      tipo: 'cargo',
      fecha: p.fecha,
      periodo: periodoDe(p.fecha),
      importe,
      reserva_id: reserva.id,
      detalle: `${espacio.nombre}, ${p.desdeHora.slice(0, 5)} a ${p.hastaHora.slice(0, 5)}`,
      quien: p.quien,
    });
  }
  return { ok: true };
}

/**
 * Libera una reserva y, si corresponde, deja el crédito.
 *
 * El cargo no se borra: la hora existió y queda anotada. Lo que la compensa es
 * un crédito, que descuenta del mes siguiente.
 */
/**
 * Deshace una reserva recién hecha: la cancela y borra su cargo.
 *
 * No es lo mismo que soltarla. Soltar devuelve una hora que se tomó de verdad y
 * por eso el cargo queda con un crédito que lo compensa; acá no hubo alquiler,
 * hubo un dedo en la fila equivocada, y dejar cargo más crédito en la cuenta
 * obliga a explicar dos renglones que se anulan.
 */
export async function deshacerReserva(reservaId: string): Promise<void> {
  await patch('reservas', `id=eq.${reservaId}`, { estado: 'cancelada' });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY as string;
  await fetch(`${url}/rest/v1/movimientos?reserva_id=eq.${reservaId}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
}

export async function liberarReserva(
  reservaId: string,
  conCredito: boolean,
  motivo: string,
  quien: string
): Promise<void> {
  await patch('reservas', `id=eq.${reservaId}`, { estado: 'liberada' });
  if (!conCredito) return;
  const cargos = await select<{ importe: number; periodo: string; inquilino_id: string }>(
    'movimientos',
    `select=importe,periodo,inquilino_id&reserva_id=eq.${reservaId}&tipo=eq.cargo`
  );
  for (const c of cargos) {
    await insert('movimientos', {
      inquilino_id: c.inquilino_id,
      tipo: 'credito',
      fecha: new Date().toISOString().slice(0, 10),
      periodo: c.periodo,
      importe: c.importe,
      reserva_id: reservaId,
      detalle: motivo,
      quien,
    });
  }
}

/** Cuántas horas soltó con crédito este mes: el tope es lo que impide que una
 *  banda de ocho horas se desarme de a pedazos. */
export async function horasSoltadasEn(inquilinoId: string, periodo: string): Promise<number> {
  const creditos = await select<{ reserva_id: string | null }>(
    'movimientos',
    `select=reserva_id&inquilino_id=eq.${inquilinoId}&periodo=eq.${periodo}&tipo=eq.credito`
  );
  const ids = creditos.map((c) => c.reserva_id).filter(Boolean) as string[];
  if (ids.length === 0) return 0;
  const reservas = await select<{ desde_hora: string; hasta_hora: string }>(
    'reservas',
    `select=desde_hora,hasta_hora&id=in.(${ids.join(',')})`
  );
  return reservas.reduce((n, r) => n + (hora(r.hasta_hora) - hora(r.desde_hora)), 0);
}
