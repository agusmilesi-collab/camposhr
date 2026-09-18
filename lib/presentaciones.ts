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
  /**
   * El programa al que pertenece, cuando la charla es parte de uno. Null en las
   * sueltas: una charla que se dicta una vez para un cliente no cuelga de
   * ningún ciclo, y antes no tenía dónde entrar en el índice.
   */
  ciclo: string | null;
  /**
   * Null cuando la charla sirve para cualquier cliente. El material del ciclo
   * con actividades es el mismo para todos: quién lo está dictando se resuelve
   * al abrirlo, con lo que trae el enlace del tablero.
   */
  cliente: string | null;
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

/**
 * El ciclo como dirección: "Liderazgos Humanos · plan B" -> "liderazgos-humanos-plan-b".
 *
 * Sale del nombre y no de un campo nuevo en el índice: el nombre ya es único, y
 * un identificador aparte obliga a mantener dos cosas en línea.
 */
export function slugDeCiclo(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Las charlas de un ciclo, por su dirección. Vacío si no existe. */
export function charlasDelCiclo(slug: string): { ciclo: string; charlas: Presentacion[] } | null {
  const filas = listarPresentaciones().filter((p) => p.ciclo && slugDeCiclo(p.ciclo) === slug);
  if (filas.length === 0) return null;
  return { ciclo: filas[0].ciclo as string, charlas: filas.sort((a, b) => a.orden - b.orden) };
}

/**
 * Una charla por su token.
 *
 * La usa el hub del encuentro: una charla suelta dictada a un cliente tiene su
 * propia pantalla, y el token es lo único que la identifica sin ambigüedad. El
 * título no alcanza, porque la misma charla se le puede dictar a dos clientes.
 */
export function charlaPorToken(token: string): Presentacion | null {
  if (!TOKEN_VALIDO.test(token)) return null;
  return listarPresentaciones().find((p) => p.token === token) ?? null;
}
