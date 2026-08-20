/**
 * Oportunidades comerciales y sus costos.
 *
 * Es un embudo de cuatro estados y no un archivo de propuestas: Lead cuando hay
 * interés y todavía no se mandó nada, Enviada cuando la propuesta está del lado
 * del cliente, Aprobada cuando se cerró y Perdida cuando no.
 *
 * **El índice vive en Supabase; el documento sigue siendo un archivo.** La
 * propuesta que abre el cliente es un HTML estático en `public/q/<token>.html`,
 * servido por una dirección secreta. Lo que se mudó a la base es el seguimiento:
 * cambiar "enviada" por "aprobada" no puede costar un despliegue.
 *
 * El índice viejo quedó en `data/cotizaciones.json`, ya migrado y sin uso. Ver
 * `supabase/comercial.sql` y `supabase/comercial-semilla.sql`.
 */

import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_COMERCIAL } from '@/lib/etiquetas';
import type { Estado } from '@/lib/comercial-tipos';

export {
  ABIERTOS,
  ESTADOS,
  TIPOS_COSTO,
  formatoFecha,
  formatoImporte,
  resultadoDe,
  type Estado,
  type Resultado,
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
  motivo: string | null;
};

type Fila = Omit<Cotizacion, 'importe' | 'empresaId'> & {
  importe: string | number;
  empresa_id: string | null;
};

const CAMPOS =
  'id,empresa_id,cliente,concepto,importe,moneda,version,estado,fecha,token,archivo,nota,motivo';

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
  };
}

/** Todas, de la más reciente a la más vieja. */
export async function listarCotizaciones(): Promise<Cotizacion[]> {
  try {
    const filas = await select<Fila>(
      'cotizaciones',
      `select=${CAMPOS}&order=fecha.desc,created_at.desc`,
      CACHE_COMERCIAL
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
    }>(
      'costos',
      'select=id,cotizacion_id,concepto,importe,tipo,fecha,nota&order=fecha.desc',
      CACHE_COMERCIAL
    );
    return filas.map((f) => ({
      id: f.id,
      cotizacionId: f.cotizacion_id,
      concepto: f.concepto,
      importe: Number(f.importe),
      tipo: f.tipo,
      fecha: f.fecha,
      nota: f.nota,
    }));
  } catch {
    return [];
  }
}

