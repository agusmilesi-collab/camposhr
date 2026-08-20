import 'server-only';
import { select } from '@/lib/supabase';

/**
 * Las baterías del OS, con su historia de precios.
 *
 * Va aparte de `lib/baterias.ts`, que es la lista fija que ve el cliente en su
 * portal para elegir el alcance: ahí el precio no viaja a propósito. Acá se lee
 * de Supabase y el precio es el dato central.
 *
 * El precio de una evaluación es el que regía el día de su pedido, no el de
 * hoy: las actualizaciones valen para adelante (ver
 * `supabase/precios-de-baterias.sql`).
 *
 * La resolución se hace acá y no con una vista de la base porque son tres
 * baterías con pocas filas de precio cada una, y tenerlo en código deja a la
 * vista la regla, que es lo que se olvida.
 */

export type Precio = {
  id: string;
  bateria_id: string;
  precio: number;
  desde: string;
  quien: string | null;
};

export type Bateria = {
  id: string;
  codigo: string;
  nombre: string | null;
  descripcion: string | null;
  duracion_min: number | null;
  tests: string[];
  outputs: string[];
  /** La historia, de la más nueva a la más vieja. */
  precios: Precio[];
};

const CAMPOS = 'id,codigo,nombre,descripcion,duracion_min,tests,outputs';

/**
 * El precio que regía en una fecha.
 *
 * Con `fecha` en null devuelve el vigente hoy. Null significa que la batería
 * todavía no tiene ningún precio cargado para ese momento, que es distinto de
 * valer cero.
 */
export function precioA(precios: Precio[], fecha?: string | null): number | null {
  const dia = fecha ? fecha.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const vigente = precios.filter((p) => p.desde <= dia).sort((a, b) => b.desde.localeCompare(a.desde))[0];
  return vigente ? Number(vigente.precio) : null;
}

/** El próximo aumento ya cargado, si hay uno con fecha futura. */
export function proximo(precios: Precio[]): Precio | null {
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    precios
      .filter((p) => p.desde > hoy)
      .sort((a, b) => a.desde.localeCompare(b.desde))[0] ?? null
  );
}

/** El adicional del Benziger. Se define en `lib/benziger.ts`, que también lo
 *  leen las pantallas del navegador. */
export { BENZIGER_USD } from '@/lib/benziger';

export type Cambio = { valor: number; fecha: string } | null;

/**
 * El dólar tarjeta de hoy, de dolarapi.com.
 *
 * Se cachea media hora: la cotización se mueve una vez por día y no vale la
 * pena una llamada externa por cada visita a la pantalla. Si la API no
 * contesta, la pantalla muestra el precio en dólares sin pesificar en vez de
 * romperse, que es lo que corresponde cuando el dato es de afuera.
 */
export async function dolarTarjeta(): Promise<Cambio> {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/tarjeta', {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    const d = await res.json();
    const valor = Number(d?.venta);
    return Number.isFinite(valor) ? { valor, fecha: d?.fechaActualizacion ?? '' } : null;
  } catch {
    return null;
  }
}

export async function baterias(): Promise<Bateria[]> {
  try {
    const [filas, precios] = await Promise.all([
      select<Omit<Bateria, 'precios'>>('baterias', `select=${CAMPOS}&order=codigo.asc`),
      select<Precio>('bateria_precios', 'select=id,bateria_id,precio,desde,quien&order=desde.desc'),
    ]);
    return filas.map((b) => ({
      ...b,
      precios: precios.filter((p) => p.bateria_id === b.id),
    }));
  } catch {
    return [];
  }
}
