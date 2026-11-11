/**
 * Reservar y liberar, de los dos lados.
 *
 * El OS y la zona del inquilino escriben lo mismo, así que la cuenta del
 * importe y el cargo viven acá y no en cada ruta: dos copias de esta lógica se
 * separan al primer cambio de precio, y entonces lo que cobra una pantalla deja
 * de ser lo que cobra la otra.
 */

import 'server-only';
import { revalidateTag } from 'next/cache';
import { CACHE_COMERCIAL } from '@/lib/etiquetas';

import { insert, patch, select } from '@/lib/supabase';
import { HORAS_PARA_SOLTAR, HORAS_LIBERABLES, MINUTOS_PARA_DESHACER, hoyISO } from '@/lib/consultorios-calculo';
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
export { HORAS_PARA_SOLTAR, HORAS_LIBERABLES, MINUTOS_PARA_DESHACER } from '@/lib/consultorios-calculo';

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
  // La suelta va a precio de suelta: su tramo es el de esta reserva sola. Solo
  // la banda fija entra al tramo de lo contratado.
  const tramo =
    (p.origen ?? 'suelta') === 'contrato'
      ? Math.max(horasSemanalesTotales(contratos, p.inquilinoId, p.fecha), horas)
      : horas;
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
  // definir. La reserva vale igual, porque ocupa la sala. Si el cargo no
  // entra, la reserva se borra: una hora reservada sin cobrar no se reclama.
  if (importe !== null) {
    try {
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
    } catch (e) {
      await borrarReserva(reserva.id);
      throw e;
    }
  }
  invalidarCentro();
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
  if (!(await pasarDeActiva(reservaId, 'cancelada'))) return;
  invalidarCentro();
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
): Promise<boolean> {
  // Solo si sigue activa: dos pedidos seguidos (un doble toque, un reintento)
  // dejaban dos créditos por el mismo cargo. El segundo no encuentra nada que
  // cambiar y no sigue.
  if (!(await pasarDeActiva(reservaId, 'liberada'))) return false;
  invalidarCentro();
  if (!conCredito) return true;
  const cargos = await select<{ importe: number; periodo: string; inquilino_id: string }>(
    'movimientos',
    `select=importe,periodo,inquilino_id&reserva_id=eq.${reservaId}&tipo=eq.cargo`
  );
  for (const c of cargos) {
    await insert('movimientos', {
      inquilino_id: c.inquilino_id,
      tipo: 'credito',
      // La fecha de Argentina: en UTC, después de las 21 quedaba fechado mañana.
      fecha: hoyISO(),
      periodo: c.periodo,
      importe: c.importe,
      reserva_id: reservaId,
      detalle: motivo,
      quien,
    });
  }
  return true;
}

/**
 * Cambia el estado de una reserva solo si sigue activa, y dice si la cambió.
 * Es lo que hace que soltar, deshacer o liberar dos veces no dupliquen nada.
 */
export async function pasarDeActiva(reservaId: string, estado: 'liberada' | 'cancelada'): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY as string;
  const res = await fetch(`${url}/rest/v1/reservas?id=eq.${reservaId}&estado=eq.activa`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ estado }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase PATCH reservas ${res.status}: ${await res.text()}`);
  return ((await res.json()) as unknown[]).length > 0;
}

/**
 * Las horas soltadas con crédito de cada persona en esos meses, con clave
 * `inquilino|periodo`: el calendario del OS las muestra al liberar, para que
 * se vea el tope de 2 por mes antes de decidir.
 */
export async function horasSoltadasPorPeriodo(periodos: string[]): Promise<Record<string, number>> {
  if (periodos.length === 0) return {};
  const creditos = await select<{ reserva_id: string | null; inquilino_id: string; periodo: string }>(
    'movimientos',
    `select=reserva_id,inquilino_id,periodo&tipo=eq.credito&reserva_id=not.is.null&periodo=in.(${periodos.join(',')})`
  );
  const ids = [...new Set(creditos.map((c) => c.reserva_id as string))];
  if (ids.length === 0) return {};
  const reservas = await select<{ id: string; desde_hora: string; hasta_hora: string }>(
    'reservas',
    `select=id,desde_hora,hasta_hora&id=in.(${ids.join(',')})`
  );
  const salida: Record<string, number> = {};
  for (const c of creditos) {
    const r = reservas.find((x) => x.id === c.reserva_id);
    if (!r) continue;
    const clave = `${c.inquilino_id}|${c.periodo}`;
    salida[clave] = (salida[clave] ?? 0) + hora(r.hasta_hora) - hora(r.desde_hora);
  }
  return salida;
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

/**
 * Después de escribir en el Centro: las pantallas del módulo (etiqueta
 * 'consultorios') y la cola de facturar (CACHE_COMERCIAL) vuelven a leer. Sin
 * la segunda, una hora recién reservada o soltada tardaba cinco minutos en
 * verse en la factura del mes.
 */
export function invalidarCentro(): void {
  revalidateTag('consultorios', { expire: 0 });
  revalidateTag(CACHE_COMERCIAL, { expire: 0 });
}

/** Borra una reserva que no llegó a tener su cargo. */
export async function borrarReserva(reservaId: string): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY as string;
  await fetch(`${url}/rest/v1/reservas?id=eq.${reservaId}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
}

/**
 * Copia al mes los gastos marcados "todos los meses" del mes anterior que
 * todavía no estén (mismo concepto y rubro). El tilde se guardaba y nadie lo
 * repetía, así que el resultado de los meses siguientes salía sin el alquiler
 * ni las expensas. Lo corre la apertura de cada mes y el botón de Finanzas.
 * Devuelve cuántos copió.
 */
export async function copiarGastosFijos(periodo: string, quien: string): Promise<number> {
  const anterior = mesCorridoDe(periodo, -1);
  const [delAnterior, deEste] = await Promise.all([
    select<{ concepto: string; rubro: string; importe: number }>(
      'gastos',
      `select=concepto,rubro,importe&periodo=eq.${anterior}&fijo=is.true`
    ),
    select<{ concepto: string; rubro: string }>('gastos', `select=concepto,rubro&periodo=eq.${periodo}`),
  ]);
  const faltan = delAnterior.filter((g) => !deEste.some((x) => x.concepto === g.concepto && x.rubro === g.rubro));
  for (const g of faltan) {
    await insert('gastos', {
      fecha: periodo,
      periodo,
      concepto: g.concepto,
      rubro: g.rubro,
      importe: Number(g.importe),
      fijo: true,
      quien,
    });
  }
  if (faltan.length > 0) invalidarCentro();
  return faltan.length;
}

function mesCorridoDe(iso: string, n: number): string {
  const [a, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1 + n, 1, 12)).toISOString().slice(0, 10);
}
