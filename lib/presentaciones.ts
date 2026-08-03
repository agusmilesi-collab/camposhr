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
 * El enlace es secreto, igual que en cotizaciones: quien tiene el token ve la
 * presentación, así que el token lleva una parte al azar.
 */

import 'server-only';
import indice from '@/data/presentaciones.json';

export type Presentacion = {
  token: string;
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
  archivo: string;
  nota?: string | null;
};

const TOKEN_VALIDO = /^[A-Za-z0-9_-]{6,128}$/;

/** Todas las presentaciones, agrupables por ciclo y ordenadas por fecha. */
export function listarPresentaciones(): Presentacion[] {
  return (indice as Presentacion[])
    .filter((p) => TOKEN_VALIDO.test(p.token))
    .slice()
    .sort((a, b) => {
      const porFecha = (a.fecha ?? '').localeCompare(b.fecha ?? '');
      if (porFecha !== 0) return porFecha;
      return a.orden - b.orden;
    });
}

/** Las presentaciones agrupadas por ciclo, respetando el orden de arriba. */
export function porCiclo(
  todas: Presentacion[]
): { ciclo: string; cliente: string; encuentros: Presentacion[] }[] {
  const grupos: Record<string, Presentacion[]> = {};
  for (const p of todas) {
    const clave = `${p.ciclo} · ${p.cliente}`;
    (grupos[clave] ??= []).push(p);
  }
  return Object.values(grupos).map((encuentros) => ({
    ciclo: encuentros[0].ciclo,
    cliente: encuentros[0].cliente,
    encuentros,
  }));
}

/** Fecha ISO a formato corto local: "2026-08-07" -> "07/08/2026". */
export function formatoFecha(iso: string): string {
  const [a, m, d] = iso.split('-');
  if (!a || !m || !d) return iso;
  return `${d}/${m}/${a}`;
}
