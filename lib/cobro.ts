import type { Candidato } from './airtable';
import { ETAPAS_ENTREVISTADO } from './facturas-tipos';

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
/**
 * La columna de facturación no se publica para las empresas de Airtable.
 *
 * Los dos campos existen allá y están sin tildar en todos los candidatos, y
 * Airtable devuelve un campo sin tildar igual que uno sin cargar: publicada,
 * la columna le diría "Sin facturar" a cada informe entregado, que es una
 * afirmación sobre su cuenta corriente y puede ser falsa.
 *
 * **En las empresas ya migradas sí se publica**, sin depender de esto: ahí el
 * estado no sale de una tilde sino de las facturas emitidas en el OS, así que
 * es cierto. Lo resuelve el portal (`app/p/[token]/page.tsx`) mirando de dónde
 * salieron los datos. Esta constante se prende el día que no quede nadie en
 * Airtable, y entonces se puede borrar.
 */
export const COBRO_PUBLICADO = false;

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
  // Antes de que se tome la entrevista no hay nada que facturar, así que
  // tampoco hay nada que decir: "sin facturar" en un candidato que recién
  // entró se lee como algo pendiente y no lo es.
  if (!ETAPAS_ENTREVISTADO.includes(c.estado as never)) return 'sin-dato';
  if (c.facturado == null) return 'sin-dato';
  if (!c.facturado) return 'sin-facturar';
  return c.pagado ? 'pagado' : 'impago';
}
