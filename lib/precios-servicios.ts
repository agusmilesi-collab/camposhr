import 'server-only';
import { ajuste } from '@/lib/ajustes';
import { hoyIso } from '@/lib/hora';
import { ipcMensual } from '@/lib/ipc';
import { COACHING, DEVOLUCION, ENTREVISTAS } from '@/app/psicotecnicos/servicios';

/**
 * Los precios de los servicios que no son baterías: coaching, entrevista de
 * egreso, devolución y referencias.
 *
 * Salen en la página de precios (`/psicotecnicos`). El de fábrica está en
 * `app/psicotecnicos/servicios.ts` y lo que se mueve desde Configuración →
 * Precios se guarda en `ajustes` (`servicios_precios`) por tramos con fecha,
 * con la misma regla que el resto: solo la diferencia.
 *
 * La clave es la pestaña y el código de la tarjeta (`coaching:Individual`), que
 * es como la página los busca. La devolución es una sola aunque salga en dos
 * pestañas: en psicotécnicos como opcional y en entrevistas como tarjeta.
 */

export type ServicioConPrecio = {
  clave: string;
  nombre: string;
  unidad: string;
  deFabrica: number;
};

export const SERVICIOS_CON_PRECIO: ServicioConPrecio[] = [
  ...COACHING.tarjetas.map((t) => ({
    clave: `coaching:${t.codigo}`,
    nombre: `Coaching · ${t.titulo}`,
    unidad: t.unidad,
    deFabrica: t.monto,
  })),
  ...ENTREVISTAS.tarjetas.map((t) => ({
    clave: t.codigo === 'Devolución' ? 'devolucion' : `entrevistas:${t.codigo}`,
    nombre: t.titulo,
    unidad: t.unidad,
    deFabrica: t.codigo === 'Devolución' ? DEVOLUCION : t.monto,
  })),
];

/** El precio más alto que se acepta: un cero de más no puede llegar a la página. */
const TOPE = 100_000_000;

/**
 * Un juego de precios y el día desde el que rige.
 *
 * Como en las baterías, un aumento se carga con su fecha: hasta ese día sigue
 * el anterior, y ese día la página de precios pasa sola al nuevo. Cada tramo
 * guarda solo lo que difiere del de fábrica.
 */
export type TramoDePrecios = { desde: string; precios: Record<string, number> };

/** Lo que se guardaba antes de que hubiera fechas: un juego solo, vigente desde siempre. */
const DESDE_SIEMPRE = '2000-01-01';

function preciosValidos(valor: unknown): Record<string, number> | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const limpios: Record<string, number> = {};
  for (const [clave, monto] of Object.entries(valor as Record<string, unknown>)) {
    const s = SERVICIOS_CON_PRECIO.find((x) => x.clave === clave);
    if (!s) return null;
    if (typeof monto !== 'number' || !Number.isInteger(monto) || monto <= 0 || monto > TOPE) return null;
    // Igual al de fábrica no se guarda: así un cambio en el código le llega.
    if (monto !== s.deFabrica) limpios[clave] = monto;
  }
  return limpios;
}

/**
 * Lo guardado, si sirve: `{ tramos: [{ desde, precios }] }`, con fechas
 * "AAAA-MM-DD" sin repetir, ordenado por fecha. Acepta también el formato de
 * antes (los precios sueltos), que pasa a ser un tramo vigente desde siempre.
 */
export function preciosDeServiciosValidos(valor: unknown): { tramos: TramoDePrecios[] } | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const crudo = valor as Record<string, unknown>;
  if (!('tramos' in crudo)) {
    const precios = preciosValidos(crudo);
    if (!precios) return null;
    // Sin nada distinto del de fábrica no hay tramo: es como no haber guardado.
    return { tramos: Object.keys(precios).length ? [{ desde: DESDE_SIEMPRE, precios }] : [] };
  }
  if (!Array.isArray(crudo.tramos) || crudo.tramos.length > 50) return null;
  const tramos: TramoDePrecios[] = [];
  for (const t of crudo.tramos as unknown[]) {
    if (!t || typeof t !== 'object') return null;
    const { desde, precios } = t as Record<string, unknown>;
    if (typeof desde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(desde)) return null;
    if (tramos.some((x) => x.desde === desde)) return null;
    const limpios = preciosValidos(precios);
    if (!limpios) return null;
    tramos.push({ desde, precios: limpios });
  }
  return { tramos: tramos.sort((a, b) => a.desde.localeCompare(b.desde)) };
}

/** Todos los precios de un tramo, con los de fábrica donde no se movió nada. */
function completos(precios: Record<string, number>): Record<string, number> {
  return Object.fromEntries(SERVICIOS_CON_PRECIO.map((s) => [s.clave, precios[s.clave] ?? s.deFabrica]));
}

/**
 * El ajuste automático por IPC.
 *
 * Pedido de Lorena el 21/10/2026: los otros servicios suben cada trimestre con
 * el IPC acumulado, redondeado a $ 5.000. El primero es el 1/11/2026 y después
 * cada tres meses (1/2, 1/5, 1/8, 1/11). Cada ajuste usa los tres últimos meses
 * que el INDEC ya publicó ese día: el 1/11 son julio, agosto y septiembre,
 * porque octubre sale a mediados de noviembre y entra en el ajuste siguiente.
 * Así ningún mes queda afuera ni se cuenta dos veces, y no se usa ninguna
 * proyección.
 *
 * Se aplica sobre el último precio cargado a mano: un precio guardado con
 * fecha pisa el ajuste de ese trimestre y los siguientes parten de él.
 */
const PRIMER_AJUSTE = '2026-11-01';
const REDONDEO = 5_000;

export type AjustePorIpc = { desde: string; meses: string[]; porcentaje: number };

/** "2026-11-01" más n meses, en el día 1. */
function sumarMeses(fecha: string, n: number): string {
  const [a, m] = fecha.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}

/** Los meses del IPC que usa el ajuste de esa fecha: los tres que terminan dos meses antes. */
function mesesDelAjuste(desde: string): string[] {
  return [-4, -3, -2].map((n) => sumarMeses(desde, n).slice(0, 7));
}

const redondear = (n: number) => Math.round(n / REDONDEO) * REDONDEO;

/**
 * Los precios de hoy, el próximo aumento y lo que se ajustó por IPC.
 *
 * Rige el último tramo que ya empezó, con los ajustes trimestrales que vinieron
 * después; el próximo es el primer tramo cargado que todavía no empezó, o si no
 * hay, el próximo ajuste por IPC (sin precio: depende de meses sin publicar).
 */
export async function preciosDeServiciosConFechas(hoy = hoyIso()): Promise<{
  rige: Record<string, number>;
  proximo: { desde: string; precios: Record<string, number>; ajuste?: AjustePorIpc } | null;
  tramos: TramoDePrecios[];
  ajustes: AjustePorIpc[];
  proximoAjuste: string;
  /** El trimestre que ya tocaba y no se pudo aplicar porque falta un mes del IPC. */
  sinIpc: string | null;
}> {
  const [guardado, ipc] = await Promise.all([ajuste<unknown>('servicios_precios'), ipcMensual()]);
  const tramos = preciosDeServiciosValidos(guardado)?.tramos ?? [];
  const vigente = [...tramos].reverse().find((t) => t.desde <= hoy);
  const siguiente = tramos.find((t) => t.desde > hoy);

  const rige = completos(vigente?.precios ?? {});
  const ajustes: AjustePorIpc[] = [];
  let sinIpc: string | null = null;
  let fecha = PRIMER_AJUSTE;
  while (fecha <= hoy) {
    if (!vigente || fecha > vigente.desde) {
      const meses = mesesDelAjuste(fecha);
      const valores = meses.map((m) => ipc.get(m));
      if (valores.some((v) => v === undefined)) {
        sinIpc = fecha;
        break;
      }
      const factor = (valores as number[]).reduce((f, v) => f * (1 + v / 100), 1);
      for (const k of Object.keys(rige)) rige[k] = redondear(rige[k] * factor);
      ajustes.push({ desde: fecha, meses, porcentaje: Math.round((factor - 1) * 10_000) / 100 });
    }
    fecha = sumarMeses(fecha, 3);
  }

  // El próximo: el tramo cargado si llega antes que el ajuste; si no, el
  // ajuste por IPC, con precios solo si sus tres meses ya están publicados.
  let proximo: { desde: string; precios: Record<string, number>; ajuste?: AjustePorIpc } | null = null;
  if (siguiente && siguiente.desde <= fecha) {
    proximo = { desde: siguiente.desde, precios: completos(siguiente.precios) };
  } else if (!sinIpc) {
    const meses = mesesDelAjuste(fecha);
    const valores = meses.map((m) => ipc.get(m));
    if (valores.every((v) => v !== undefined)) {
      const factor = (valores as number[]).reduce((f, v) => f * (1 + v / 100), 1);
      proximo = {
        desde: fecha,
        precios: Object.fromEntries(Object.entries(rige).map(([k, v]) => [k, redondear(v * factor)])),
        ajuste: { desde: fecha, meses, porcentaje: Math.round((factor - 1) * 10_000) / 100 },
      };
    }
  }

  return { rige, proximo, tramos, ajustes, proximoAjuste: fecha, sinIpc };
}

/** El precio que rige hoy de cada servicio, por clave. */
export async function preciosDeServicios(): Promise<Record<string, number>> {
  return (await preciosDeServiciosConFechas()).rige;
}
