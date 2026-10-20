/**
 * Oportunidades comerciales y sus costos.
 *
 * Es un embudo de cuatro estados y no un archivo de propuestas: Lead cuando hay
 * interés y todavía no se mandó nada, Enviada cuando la propuesta está del lado
 * del cliente, Aprobada cuando se cerró y Perdida cuando no.
 *
 * **El índice vive en Supabase; el documento es un archivo del bucket privado.**
 * La propuesta que abre el cliente es un HTML en `cotizaciones/<token>.html`,
 * servido por una dirección secreta (`app/q/[token]/route.ts`). Ni el documento
 * ni su enlace van al repositorio, que es público. Ver `supabase/comercial.sql`.
 */

import 'server-only';
import { select } from '@/lib/supabase';
import type { Estado, Objecion } from '@/lib/comercial-tipos';

export {
  ABIERTOS,
  DIAS_SEGUIMIENTO,
  GANADOS,
  ESTADOS,
  OBJECIONES,
  SERVICIOS,
  TIPOS_COSTO,
  formatoFecha,
  formatoImporte,
  resultadoDe,
  type Estado,
  type Objecion,
  type Resultado,
  type Servicio,
  type TipoCosto,
} from '@/lib/comercial-tipos';

export type Cotizacion = {
  id: string;
  empresaId: string | null;
  cliente: string;
  concepto: string;
  importe: number;
  moneda: string;
  version: string;
  estado: Estado;
  fecha: string;
  /** El enlace secreto del documento, cuando ya hay uno escrito. */
  token: string | null;
  archivo: string | null;
  nota: string | null;
  /** El detalle escrito de la perdida. */
  motivo: string | null;
  /** Con cuál de las cinco objeciones se perdió. */
  objecion: Objecion | null;
  /** La última vez que se siguió, cuando ya se siguió alguna. */
  seguimientoEl: string | null;
  /** El día en que se repartió entre los socios lo que dejó. Nulo si no se repartió. */
  repartidoEl: string | null;
};

type Fila = Omit<Cotizacion, 'importe' | 'empresaId' | 'seguimientoEl' | 'repartidoEl'> & {
  importe: string | number;
  empresa_id: string | null;
  seguimiento_el: string | null;
  repartido_el: string | null;
};

const CAMPOS =
  'id,empresa_id,cliente,concepto,importe,moneda,version,estado,fecha,token,archivo,nota,motivo,' +
  'objecion,seguimiento_el,repartido_el';

function armar(f: Fila): Cotizacion {
  return {
    id: f.id,
    empresaId: f.empresa_id,
    cliente: f.cliente,
    concepto: f.concepto,
    importe: Number(f.importe),
    moneda: f.moneda,
    version: f.version,
    estado: f.estado,
    fecha: f.fecha,
    token: f.token,
    archivo: f.archivo,
    nota: f.nota,
    motivo: f.motivo,
    objecion: f.objecion,
    seguimientoEl: f.seguimiento_el,
    repartidoEl: f.repartido_el,
  };
}

/**
 * Todas, de la más reciente a la más vieja.
 *
 * **Sin caché.** Con la etiqueta, la tarjeta recién editada volvía a mostrar
 * lo de antes: el embudo se redibuja apenas se guarda y a veces le llegaba la
 * copia vieja, y quien había corregido la nota creía que no se había guardado
 * (20/10/2026). Son pocas filas y la pantalla se abre para trabajarlas.
 */
export async function listarCotizaciones(): Promise<Cotizacion[]> {
  try {
    const filas = await select<Fila>(
      'cotizaciones',
      `select=${CAMPOS}&order=fecha.desc,created_at.desc`
    );
    return filas.map(armar);
  } catch {
    return [];
  }
}

export type Costo = {
  id: string;
  cotizacionId: string;
  concepto: string;
  importe: number;
  tipo: string;
  fecha: string;
  nota: string | null;
  /**
   * Quién puso la plata, por su nombre en el equipo.
   *
   * Nulo cuando lo pagó el estudio o cuando todavía no se cargó: un gasto sin
   * dueño se resta del pozo igual, pero no se le devuelve a nadie.
   */
  pagadoPor: string | null;
};

/** Los costos de todas las oportunidades, para cruzarlos con sus ingresos. */
export async function listarCostos(): Promise<Costo[]> {
  try {
    const filas = await select<{
      id: string;
      cotizacion_id: string;
      concepto: string;
      importe: string | number;
      tipo: string;
      fecha: string;
      nota: string | null;
      pagado_por: string | null;
    }>(
      'costos',
      // Sin caché, por lo mismo que las cotizaciones.
      'select=id,cotizacion_id,concepto,importe,tipo,fecha,nota,pagado_por&order=fecha.desc'
    );
    return filas.map((f) => ({
      id: f.id,
      cotizacionId: f.cotizacion_id,
      concepto: f.concepto,
      importe: Number(f.importe),
      tipo: f.tipo,
      fecha: f.fecha,
      nota: f.nota,
      pagadoPor: f.pagado_por,
    }));
  } catch {
    return [];
  }
}

