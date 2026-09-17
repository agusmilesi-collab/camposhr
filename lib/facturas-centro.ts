import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_COMERCIAL } from '@/lib/etiquetas';

/**
 * Facturar el alquiler de consultorios.
 *
 * Es el mismo comprobante que el de psicotécnicos, con el mismo emisor y la
 * misma numeración: lo que cambia es el receptor, que acá es un inquilino y no
 * una empresa, y de dónde sale el importe.
 *
 * **Lo que se factura de un mes es lo que sumó ese mes**, que son los
 * movimientos de tipo cargo del período: las horas reservadas se cobran cuando
 * la reserva se confirma y quedan como cargo. Los pagos no entran, que son otro
 * eje: una factura emitida puede estar sin cobrar.
 *
 * **Un cargo se factura una sola vez.** El renglón guarda de qué movimiento
 * salió (`factura_items.movimiento_id`), así un mes ya facturado deja de
 * aparecer en la cola aunque alguien vuelva a entrar a la pantalla.
 */

export type CargoPendiente = {
  id: string;
  fecha: string;
  periodo: string | null;
  importe: number;
  detalle: string | null;
};

export type InquilinoAFacturar = {
  id: string;
  nombre: string;
  razonSocial: string | null;
  cuit: string | null;
  condicionIva: string | null;
  /** Los cargos de ese período que todavía no entraron en ninguna factura. */
  cargos: CargoPendiente[];
  total: number;
};

type FilaInquilino = {
  id: string;
  nombre: string;
  razon_social: string | null;
  cuit: string | null;
  condicion_iva: string | null;
  activo: boolean;
};

type FilaMovimiento = {
  id: string;
  inquilino_id: string;
  tipo: string;
  fecha: string;
  periodo: string | null;
  importe: string | number;
  detalle: string | null;
};

/**
 * El período del Centro es el primer día del mes ("2026-09-01"), que es como lo
 * guarda `movimientos.periodo`, una columna de fecha.
 */
export function periodoDelMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Cómo se escribe un período en pantalla: "septiembre de 2026". */
export function periodoLindo(periodo: string): string {
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(
    new Date(`${periodo.slice(0, 7)}-01T12:00:00-03:00`)
  );
}

/**
 * Qué hay para facturar de un período, por inquilino.
 *
 * Trae a los inquilinos activos con sus cargos de ese mes sin facturar. Los que
 * no tienen nada quedan afuera: la cola muestra trabajo, no un padrón.
 */
export async function aFacturarDelCentro(periodo: string): Promise<InquilinoAFacturar[]> {
  const [inquilinos, movimientos, renglones] = await Promise.all([
    select<FilaInquilino>(
      'inquilinos',
      'select=id,nombre,razon_social,cuit,condicion_iva,activo&order=nombre.asc',
      CACHE_COMERCIAL
    ),
    select<FilaMovimiento>(
      'movimientos',
      `select=id,inquilino_id,tipo,fecha,periodo,importe,detalle&periodo=eq.${periodo}` +
        '&order=fecha.asc',
      CACHE_COMERCIAL
    ),
    select<{ movimiento_id: string | null }>(
      'factura_items',
      'select=movimiento_id&movimiento_id=not.is.null',
      CACHE_COMERCIAL
    ),
  ]);

  const facturados = new Set(renglones.map((r) => r.movimiento_id));

  return inquilinos
    .filter((i) => i.activo)
    .map((i) => {
      const cargos = movimientos
        .filter((m) => m.inquilino_id === i.id && m.tipo === 'cargo' && !facturados.has(m.id))
        .map((m) => ({
          id: m.id,
          fecha: m.fecha,
          periodo: m.periodo,
          importe: Number(m.importe),
          detalle: m.detalle,
        }));
      return {
        id: i.id,
        nombre: i.nombre,
        razonSocial: i.razon_social,
        cuit: i.cuit,
        condicionIva: i.condicion_iva,
        cargos,
        total: cargos.reduce((n, c) => n + c.importe, 0),
      };
    })
    .filter((i) => i.cargos.length > 0);
}

export type FacturaDelCentro = {
  id: string;
  numero: number | null;
  puntoVenta: number | null;
  fecha: string;
  periodo: string | null;
  inquilinoId: string;
  inquilino: string;
  emisor: string;
  importe: number | null;
  estado: string;
  cobradaAt: string | null;
};

type FilaFacturaCentro = {
  id: string;
  numero: number | null;
  punto_venta: number | null;
  fecha: string;
  periodo: string | null;
  inquilino_id: string;
  imp_total: string | number | null;
  estado: string;
  cobrada_at: string | null;
  inquilinos: { nombre: string } | null;
  emisores: { razon_social: string; evaluadoras: { nombre: string } | null } | null;
};

/** Las facturas del Centro, de la más nueva a la más vieja. */
export async function facturasDelCentro(inquilinoId?: string): Promise<FacturaDelCentro[]> {
  const filtro = inquilinoId ? `&inquilino_id=eq.${inquilinoId}` : '&inquilino_id=not.is.null';
  const filas = await select<FilaFacturaCentro>(
    'facturas',
    'select=id,numero,punto_venta,fecha,periodo,inquilino_id,imp_total,estado,cobrada_at,' +
      'inquilinos(nombre),emisores(razon_social,evaluadoras(nombre))' +
      `${filtro}&order=fecha.desc,numero.desc`,
    CACHE_COMERCIAL
  );
  return filas.map((f) => ({
    id: f.id,
    numero: f.numero,
    puntoVenta: f.punto_venta,
    fecha: f.fecha,
    periodo: f.periodo,
    inquilinoId: f.inquilino_id,
    inquilino: f.inquilinos?.nombre ?? '—',
    emisor: f.emisores?.evaluadoras?.nombre ?? f.emisores?.razon_social ?? '—',
    importe: f.imp_total === null ? null : Number(f.imp_total),
    estado: f.estado,
    cobradaAt: f.cobrada_at,
  }));
}
