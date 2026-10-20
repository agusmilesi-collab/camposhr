import 'server-only';
import { ajuste } from '@/lib/ajustes';
import { COACHING, DEVOLUCION, ENTREVISTAS } from '@/app/psicotecnicos/servicios';

/**
 * Los precios de los servicios que no son baterías: coaching, entrevista de
 * egreso, devolución y referencias.
 *
 * Salen en la página de precios (`/psicotecnicos`) y no pasan por el OS, así
 * que no tienen la historia de precios de las baterías: es un número por
 * servicio. El de fábrica está en `app/psicotecnicos/servicios.ts` y lo que se
 * mueve desde Configuración → Precios se guarda en `ajustes`
 * (`servicios_precios`), con la misma regla que el resto: solo la diferencia.
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

/** Lo guardado, si sirve: solo claves que existan y montos enteros positivos. */
export function preciosDeServiciosValidos(valor: unknown): Record<string, number> | null {
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

/** El precio que rige de cada servicio, por clave. */
export async function preciosDeServicios(): Promise<Record<string, number>> {
  const movidos = preciosDeServiciosValidos(await ajuste<unknown>('servicios_precios')) ?? {};
  return Object.fromEntries(SERVICIOS_CON_PRECIO.map((s) => [s.clave, movidos[s.clave] ?? s.deFabrica]));
}
