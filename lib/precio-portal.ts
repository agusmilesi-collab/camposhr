import 'server-only';
import { RESPALDO, type BateriaDelPortal } from '@/lib/baterias';
import {
  BENZIGER_USD,
  baterias as leerBaterias,
  dolarTarjeta,
  precioA,
} from '@/lib/baterias-precios';

/**
 * Lo que el cliente ve al elegir, con lo que sale.
 *
 * Hasta el 26/8/2026 el portal mostraba el alcance de cada batería y el precio
 * quedaba afuera, para acordarlo por otro lado. Se decidió mostrarlo: quien
 * pide una evaluación desde su portal está comprando, y una decisión de compra
 * sin el precio delante se posterga.
 *
 * **Sale de donde se edita**, que es Configuración → Baterías: la misma tabla
 * de precios que usa el OS y la misma regla, vale el último cargado con fecha
 * hasta hoy. Dos lugares para el mismo precio serían dos precios.
 *
 * **Todo se cobra en pesos.** La evaluación de perfil está fijada en dólares
 * y se pesifica al dólar tarjeta del día en que se emite la factura, así que lo
 * que el portal muestra es el valor de hoy y se dice: el definitivo es el del
 * día de la factura.
 */
export type BateriaConPrecio = BateriaDelPortal & {
  /** Por candidato, en pesos. Null si esa batería no tiene precio cargado. */
  precio: number | null;
};

export type Alcance = {
  baterias: BateriaConPrecio[];
  /**
   * Lo que sale sumar la evaluación de perfil, por candidato.
   *
   * Está fijado en dólares y se cobra en pesos, al dólar tarjeta del día en que
   * se emite la factura. Lo que se muestra es el de hoy.
   */
  benzigerUsd: number;
  /**
   * A cuánto está el dólar tarjeta.
   *
   * Null cuando la cotización no llegó: el portal muestra los dólares sin
   * pesificar en vez de romperse, que es lo que corresponde cuando el dato
   * viene de afuera.
   */
  dolar: number | null;
};

export async function alcanceYPrecios(): Promise<Alcance> {
  try {
    const [filas, cambio] = await Promise.all([leerBaterias(), dolarTarjeta()]);

    // Una batería sin sus dos textos no se puede ofrecer: el cliente elegiría a
    // ciegas. Si no queda ninguna, se muestra el respaldo.
    const listas: BateriaConPrecio[] = filas
      .filter((b) => b.descripcion && b.para_quien)
      .map((b) => ({
        codigo: b.codigo,
        queIncluye: b.descripcion as string,
        paraQuien: b.para_quien as string,
        minutos: b.duracion_min,
        precio: precioA(b.precios),
      }));

    return {
      baterias: listas.length ? listas : RESPALDO.map((b) => ({ ...b, precio: null })),
      benzigerUsd: BENZIGER_USD,
      dolar: cambio?.valor ?? null,
    };
  } catch {
    return {
      baterias: RESPALDO.map((b) => ({ ...b, precio: null })),
      benzigerUsd: BENZIGER_USD,
      dolar: null,
    };
  }
}
