/**
 * Cotizaciones enviadas a clientes.
 *
 * El índice vive en `data/cotizaciones.json` y el documento de cada una en
 * `public/q/<archivo>`, que es lo que ve el cliente al abrir su enlace. No hay
 * base de datos detrás: alta de una cotización = copiar el HTML de la propuesta
 * a public/q/ y sumar una fila al JSON. Queda versionado en git y se publica
 * con el deploy.
 *
 * El enlace es secreto: quien tiene el token ve el documento, así que el token
 * se genera al azar y nunca se deriva del nombre del cliente solo.
 */

import 'server-only';
import indice from '@/data/cotizaciones.json';

export const ESTADOS = [
  'Borrador',
  'Enviada',
  'Aprobada',
  'Rechazada',
  'Cancelada',
] as const;

export type Estado = (typeof ESTADOS)[number];

export type Cotizacion = {
  token: string;
  fecha: string;
  cliente: string;
  concepto: string;
  importe: number;
  version: string;
  estado: Estado;
  archivo: string;
  /** Token de la versión anterior, cuando esta cotización la reemplaza. */
  reemplazaA: string | null;
  nota?: string | null;
};

const TOKEN_VALIDO = /^[A-Za-z0-9_-]{6,128}$/;

/** Todas las cotizaciones, de la más reciente a la más vieja. */
export function listarCotizaciones(): Cotizacion[] {
  return (indice as Cotizacion[])
    .filter((c) => TOKEN_VALIDO.test(c.token))
    .slice()
    .sort((a, b) => {
      const porFecha = (b.fecha ?? '').localeCompare(a.fecha ?? '');
      if (porFecha !== 0) return porFecha;
      // Misma fecha: la versión más alta primero.
      return b.version.localeCompare(a.version, undefined, { numeric: true });
    });
}

/** Importe en pesos, sin decimales: 8800000 -> "ARS 8.800.000". */
export function formatoImporte(n: number): string {
  return `ARS ${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

/** Fecha ISO a formato corto local: "2026-07-30" -> "30/07/2026". */
export function formatoFecha(iso: string): string {
  const [a, m, d] = iso.split('-');
  if (!a || !m || !d) return iso;
  return `${d}/${m}/${a}`;
}

/**
 * Versiones anteriores de una cotización, siguiendo la cadena de reemplazos.
 * Sirve para mostrar "reemplaza a la v1.0" en el listado.
 */
export function versionAnterior(
  c: Cotizacion,
  todas: Cotizacion[]
): Cotizacion | null {
  if (!c.reemplazaA) return null;
  return todas.find((o) => o.token === c.reemplazaA) ?? null;
}
