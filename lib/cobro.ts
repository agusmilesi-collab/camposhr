import type { Candidato } from './airtable';

/**
 * Estado de cobro de una evaluación, resuelto a un solo valor.
 *
 * En Airtable son dos tildes (Facturado y Factura pagada) y están encadenadas:
 * sin factura no hay pago que mirar. En pantalla se muestran como un estado,
 * porque lo que se quiere saber de un vistazo es hasta dónde llegó el cobro.
 *
 * Vive acá y no adentro de una tabla porque lo usan las dos: la de búsquedas en
 * curso y la de informes entregados.
 */
export type EstadoCobro = 'pagado' | 'impago' | 'sin-facturar' | 'sin-dato';

export const COBROS: Record<
  EstadoCobro,
  { texto: string; clase: string; detalle: string }
> = {
  pagado:         { texto: 'Pagado',       clase: 'green', detalle: 'Facturado y cobrado' },
  impago:         { texto: 'Impago',       clase: 'amber', detalle: 'Facturado, sin cobrar' },
  'sin-facturar': { texto: 'Sin facturar', clase: 'gray',  detalle: 'Todavía sin facturar' },
  'sin-dato':     { texto: '—',            clase: 'gray',  detalle: 'Sin cargar' },
};

/** Del cobro pendiente al cobrado: lo que falta plata primero. */
export const ORDEN_COBRO: Record<EstadoCobro, number> = {
  'sin-facturar': 0,
  impago: 1,
  pagado: 2,
  'sin-dato': 3,
};

export function cobro(c: Candidato): EstadoCobro {
  if (c.facturado == null) return 'sin-dato';
  if (!c.facturado) return 'sin-facturar';
  return c.pagado ? 'pagado' : 'impago';
}
