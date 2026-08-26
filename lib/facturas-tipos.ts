/**
 * Los tipos y las constantes de facturación, sin nada del servidor adentro.
 *
 * Vive aparte de `lib/facturas.ts` porque ese lee Supabase y lleva
 * `server-only`: un componente de cliente que importe de ahí no compila, y del
 * lado del servidor la constante llega vacía sin que nada falle. La misma
 * separación que hay entre `comercial-tipos` y `cotizaciones`.
 */

export { formatoFecha, formatoImporte } from '@/lib/comercial-tipos';

/** Los estados del comprobante, los mismos que maneja ARCA. */
export const ESTADOS_FACTURA = ['borrador', 'emitida', 'rechazada', 'anulada'] as const;
export type EstadoFactura = (typeof ESTADOS_FACTURA)[number];

/**
 * Las etapas en las que la entrevista ya se tomó.
 *
 * Es lo que define qué está para facturar, y por eso no incluye "Entregado"
 * solo: el trabajo que se factura es la evaluación, y esa terminó cuando la
 * persona se sentó. Escribir el informe es lo que sigue, y puede tardar.
 */
export const ETAPAS_ENTREVISTADO = ['Por analizar', 'Entregado', 'Seguimiento'] as const;

export type Emisora = {
  id: string;
  nombre: string;
  razonSocial: string;
  nombreFantasia: string | null;
  cuit: string | null;
  puntoVenta: number | null;
  domicilio: string | null;
  inicioActividades: string | null;
  condicionIva: string;
  /** La del monotributo, para saber cuánto falta para pasarse del tope. */
  categoria: string | null;
};

export type Renglon = {
  id: string;
  evaluacionId: string | null;
  descripcion: string;
  detalle: string | null;
  importe: number | null;
  /**
   * A quién cubre el renglón, leído de la evaluación y no de la descripción.
   *
   * Las facturas que emite el OS escriben el nombre adentro de la descripción,
   * pero las 24 que vinieron de Airtable dicen "Evaluación psicotécnica" a
   * secas: para poder listar los candidatos de cualquier factura hace falta el
   * nombre de la fila, no el del texto.
   */
  persona: string | null;
  puesto: string | null;
};

/**
 * Si la factura cobra evaluaciones o un servicio de Campos HR.
 *
 * No hace falta una marca: un comprobante de psicotécnicos lleva sus candidatos
 * en los renglones y uno de servicios lleva un renglón con el concepto. La
 * factura **sin ningún renglón** no es ni una cosa ni la otra: son las dos que
 * llegaron incompletas de Airtable, y se leían como servicios porque "todos sus
 * renglones son sin evaluación" también es cierto cuando no hay ninguno. Van
 * con las de psicotécnicos, que es donde se las puede completar.
 */
export const esDeServicios = (f: Factura) =>
  f.renglones.length > 0 && f.renglones.every((r) => r.evaluacionId === null);

export const esDePsicotecnicos = (f: Factura) => !esDeServicios(f);

export type Factura = {
  id: string;
  numero: number | null;
  puntoVenta: number | null;
  fecha: string;
  emisora: string;
  emisorId: string;
  cliente: string;
  empresaId: string;
  concepto: string | null;
  ordenCompra: string | null;
  /** El trabajo que esta factura cobra, cuando salió de una cotización. */
  cotizacionId: string | null;
  importe: number | null;
  moneda: string;
  estado: EstadoFactura;
  cobradaAt: string | null;
  notas: string | null;
  cae: string | null;
  caeVenceEl: string | null;
  renglones: Renglon[];
};

/**
 * Lo que lleva facturado una emisora, en los tres cortes que importan.
 *
 * El mes y el año dicen cómo viene el trabajo; los doce meses corridos son los
 * que deciden la categoría del monotributo, que es lo que mira ARCA.
 */
export type Marcha = {
  emisorId: string;
  nombre: string;
  categoria: string | null;
  mes: number;
  anio: number;
  doce: number;
  /** Cuántas facturas suyas quedaron afuera por estar en otra moneda. */
  enDolares: number;
  /**
   * Lo facturado mes a mes, de enero a diciembre del año en curso.
   *
   * Va por año comercial y no por los doce meses corridos que decide la
   * categoría: son dos preguntas distintas. Un mes sin facturas va en cero y no
   * se saltea, porque el hueco también es el dato, y los que todavía no
   * llegaron vienen marcados para no leerlos como meses sin trabajo.
   */
  meses: {
    clave: string;
    etiqueta: string;
    futuro: boolean;
    /** Lo facturado por evaluaciones, que es la cola del pipeline. */
    psico: number;
    /** Lo facturado por servicios de Campos HR: un ciclo, una estructura. */
    servicios: number;
    total: number;
  }[];
};

/** Una evaluación con la entrevista tomada y sin comprobante. */
export type Facturable = {
  evaluacionId: string;
  candidato: string;
  puesto: string;
  empresaId: string;
  cliente: string;
  evaluadora: string | null;
  etapa: string;
  bateria: string | null;
  bateriaNombre: string | null;
  fechaEntrevista: string | null;
  fechaEntrega: string | null;
  /** El de la batería a la fecha del pedido, no el de hoy. */
  precio: number | null;
  conBenziger: boolean;
  /** El adicional ya pesificado, cuando hay cotización. */
  benziger: number | null;
  dolar: number | null;
};

/** Lo que sale de una evaluación: la batería más el adicional que corresponda. */
export function totalDe(f: Pick<Facturable, 'precio' | 'benziger'>): number {
  return (f.precio ?? 0) + (f.benziger ?? 0);
}

/**
 * El número como se lee: "0001-00000589" cuando hay punto de venta, y el
 * número solo mientras no lo haya. Los puntos de venta se cargan cuando se
 * tramiten los certificados, y hasta entonces mostrar "0000-" sería inventar
 * un dato que nadie confirmó.
 */
export function numeroDe(f: Pick<Factura, 'numero' | 'puntoVenta'>): string {
  if (f.numero === null) return 'sin número';
  const n = String(f.numero).padStart(8, '0');
  return f.puntoVenta === null ? String(f.numero) : `${String(f.puntoVenta).padStart(4, '0')}-${n}`;
}
