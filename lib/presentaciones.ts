/**
 * Presentaciones de los encuentros.
 *
 * Mismo esquema que las cotizaciones: el índice vive en
 * `data/presentaciones.json` y cada presentación es un HTML suelto en
 * `public/pres/<archivo>`. No hay base de datos: dar de alta una presentación
 * es copiar el archivo y sumar una fila al JSON. Queda versionado en git y se
 * publica con el deploy.
 *
 * Cada archivo es autosuficiente: las tipografías y las imágenes viajan
 * adentro, así que una vez descargado se abre sin internet. Eso es lo que
 * importa acá, porque los encuentros son presenciales y la conexión del lugar
 * no es nuestra.
 *
 * Una charla puede figurar en el listado antes de estar publicada: se carga la
 * fila con `token` en null y aparece sin botones. Sirve para ver el ciclo
 * completo mientras las charlas todavía se están armando.
 *
 * El enlace es secreto, igual que en cotizaciones: quien tiene el token ve la
 * presentación, así que el token lleva una parte al azar.
 */

import 'server-only';
import indice from '@/data/presentaciones.json';

export type Presentacion = {
  /** Null mientras la charla no está publicada. */
  token: string | null;
  ciclo: string;
  cliente: string;
  titulo: string;
  subtitulo: string;
  /** Cuántas placas tiene, para saber de un vistazo si está completa. */
  placas: number;
  /** Fecha en que se dicta, en formato ISO. */
  fecha: string;
  /** Orden dentro del ciclo, empezando en 1. */
  orden: number;
  archivo: string | null;
};

const TOKEN_VALIDO = /^[A-Za-z0-9_-]{6,128}$/;

/** Todas las presentaciones, en el orden en que se dictan. */
export function listarPresentaciones(): Presentacion[] {
  return (indice as Presentacion[])
    .filter((p) => p.token === null || TOKEN_VALIDO.test(p.token))
    .slice()
    .sort((a, b) => {
      const porFecha = (a.fecha ?? '').localeCompare(b.fecha ?? '');
      if (porFecha !== 0) return porFecha;
      return a.orden - b.orden;
    });
}

/** Fecha ISO a formato corto local: "2026-08-07" -> "07/08/2026". */
export function formatoFecha(iso: string): string {
  const [a, m, d] = iso.split('-');
  if (!a || !m || !d) return iso;
  return `${d}/${m}/${a}`;
}
