import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_CLIENTES, CACHE_COMERCIAL } from '@/lib/etiquetas';
import { BENZIGER_USD as BENZIGER_USD_VALOR } from '@/lib/benziger';

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
  /** A qué puestos se recomienda. Va en el portal, debajo de su nombre. */
  para_quien: string | null;
  duracion_min: number | null;
  tests: string[];
  outputs: string[];
  /** La historia, de la más nueva a la más vieja. */
  precios: Precio[];
};

const CAMPOS = 'id,codigo,nombre,descripcion,para_quien,duracion_min,tests,outputs';

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

/**
 * Un precio acordado con un cliente, con vigencia.
 *
 * Nace de una licitación: Lorena presentó precios en Cofco y se respetan el
 * plazo que fija la licitación aunque la lista general suba en el medio.
 * Mientras rige, pisa a `bateria_precios`; vencido, el cliente vuelve solo a
 * la lista general (`supabase/precios-por-cliente.sql`).
 *
 * `bateria_id` nula es el adicional Benziger, en pesos: en la lista general
 * va en dólares al dólar tarjeta del día, y una licitación lo fija en pesos.
 */
export type Acuerdo = {
  id: string;
  empresa_id: string;
  bateria_id: string | null;
  precio: number;
  desde: string;
  /** Último día en que rige. Null: sin fin. */
  hasta: string | null;
  quien: string | null;
};

/**
 * El acuerdo que rige para un concepto en una fecha, o null si el cliente no
 * tiene ninguno vigente y paga la lista general.
 *
 * `bateriaId` null pregunta por el Benziger. Con `fecha` null, hoy.
 */
export function acuerdoVigente(
  acuerdos: Acuerdo[],
  bateriaId: string | null,
  fecha?: string | null
): Acuerdo | null {
  const dia = fecha ? fecha.slice(0, 10) : new Date().toISOString().slice(0, 10);
  return (
    acuerdos
      .filter(
        (a) =>
          (a.bateria_id ?? null) === bateriaId &&
          a.desde <= dia &&
          (a.hasta === null || a.hasta >= dia)
      )
      .sort((a, b) => b.desde.localeCompare(a.desde))[0] ?? null
  );
}

/**
 * El precio de una batería para un cliente en una fecha: el acuerdo si hay
 * uno vigente, la lista general si no. `acordado` dice cuál de los dos fue,
 * que los papeles lo escriben.
 */
export function precioParaCliente(
  historia: Precio[],
  acuerdos: Acuerdo[],
  bateriaId: string | null | undefined,
  fecha?: string | null
): { precio: number | null; acordado: boolean } {
  const acuerdo = bateriaId ? acuerdoVigente(acuerdos, bateriaId, fecha) : null;
  if (acuerdo) return { precio: Number(acuerdo.precio), acordado: true };
  return { precio: precioA(historia, fecha), acordado: false };
}

/**
 * Lo que sale el Benziger para un cliente en una fecha: el importe acordado
 * en pesos si lo hay, y si no los dólares de la lista pesificados a la
 * cotización que llega. Null cuando no hay acuerdo y tampoco cotización.
 */
export function benzigerParaCliente(
  acuerdos: Acuerdo[],
  cambio: number | null,
  fecha?: string | null
): { importe: number | null; acordado: boolean } {
  const acuerdo = acuerdoVigente(acuerdos, null, fecha);
  if (acuerdo) return { importe: Number(acuerdo.precio), acordado: true };
  return { importe: cambio ? Math.round(BENZIGER_USD_VALOR * cambio) : null, acordado: false };
}

/**
 * Los acuerdos de uno o varios clientes, de los más nuevos a los más viejos.
 * Sin ids trae los de todos. Vacío si la lectura falla: el precio cae en la
 * lista general, que es lo que corresponde cuando no se puede saber más.
 */
export async function acuerdosDe(empresaIds?: string[]): Promise<Acuerdo[]> {
  const ids = empresaIds ? [...new Set(empresaIds)].filter(Boolean) : null;
  if (ids && ids.length === 0) return [];
  const filtro = ids ? `&empresa_id=in.(${ids.join(',')})` : '';
  return select<Acuerdo>(
    'empresa_precios',
    `select=id,empresa_id,bateria_id,precio,desde,hasta,quien&order=desde.desc${filtro}`,
    [CACHE_COMERCIAL, CACHE_CLIENTES]
  ).catch(() => []);
}

/**
 * La fecha que decide qué precio paga un candidato: el día en que se cargó.
 *
 * No la del pedido (decisión de Agustín, 7/10/2026): una búsqueda queda
 * abierta meses y se le siguen sumando candidatos, y con la fecha del pedido
 * uno cargado en octubre pagaba el precio de julio. Los que vinieron de
 * Airtable no guardaron cuándo se cargaron: para esos va el día de la
 * entrevista, que es lo más cercano, y recién sin entrevista el del pedido.
 *
 * La usan la cola de facturación y la orden de compra, así los dos papeles
 * dicen el mismo importe.
 */
export function fechaDePrecio(c: {
  fechaIngreso: string | null | undefined;
  fechaEntrevista: string | null | undefined;
  fechaPedido: string | null | undefined;
}): string | null {
  if (c.fechaIngreso) return c.fechaIngreso.slice(0, 10);
  if (c.fechaEntrevista) {
    // La entrevista tiene hora: el día es el de Argentina, no el de UTC.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Cordoba',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(c.fechaEntrevista));
  }
  return c.fechaPedido ? c.fechaPedido.slice(0, 10) : null;
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
