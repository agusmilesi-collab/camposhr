import 'server-only';
import { ajuste } from '@/lib/ajustes';
import { hoyIso } from '@/lib/hora';
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
    return precios ? { tramos: [{ desde: DESDE_SIEMPRE, precios }] } : null;
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
 * Los precios de hoy, el próximo aumento cargado y los tramos guardados.
 *
 * Rige el último tramo que ya empezó; el próximo es el primero que todavía no.
 */
export async function preciosDeServiciosConFechas(hoy = hoyIso()): Promise<{
  rige: Record<string, number>;
  proximo: { desde: string; precios: Record<string, number> } | null;
  tramos: TramoDePrecios[];
}> {
  const tramos = preciosDeServiciosValidos(await ajuste<unknown>('servicios_precios'))?.tramos ?? [];
  const vigente = [...tramos].reverse().find((t) => t.desde <= hoy);
  const siguiente = tramos.find((t) => t.desde > hoy);
  return {
    rige: completos(vigente?.precios ?? {}),
    proximo: siguiente ? { desde: siguiente.desde, precios: completos(siguiente.precios) } : null,
    tramos,
  };
}

/** El precio que rige hoy de cada servicio, por clave. */
export async function preciosDeServicios(): Promise<Record<string, number>> {
  return (await preciosDeServiciosConFechas()).rige;
}
