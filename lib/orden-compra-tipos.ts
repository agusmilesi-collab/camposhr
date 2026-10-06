/**
 * La orden de compra, sin nada del servidor adentro.
 *
 * Vive aparte de `lib/orden-compra.ts`, que lee y escribe en Supabase, porque
 * la pantalla de confirmación del portal es un componente de cliente y no
 * puede importar de ahí. La misma separación que `facturas-tipos`.
 */

import { formatoFecha } from '@/lib/comercial-tipos';

export type FilaOrden = {
  concepto: string;
  /** Sobre quién: el nombre de la persona. */
  detalle: string;
  /**
   * La aclaración del renglón (con qué dólar se pesificó el adicional). Es la
   * misma en casi todos, así que la orden la dice una vez, al pie del detalle.
   */
  nota: string;
  importe: number | null;
};

export type Orden = {
  id: string;
  /** "0004". Null solo en los recibos viejos que no llegaron a numerarse. */
  numero: string | null;
  /** Con esto la baja el cliente sin sesión. Null en los recibos viejos. */
  token: string | null;
  fecha: string;
  cliente: string;
  /** Quién de la empresa pidió el trabajo. Puede ser más de uno. */
  solicitantes: string[];
  estado: string;
  /** La orden de compra del propio cliente, cuando exige una. */
  referencia: string | null;
  /**
   * Los números de las órdenes que este papel junta. Una factura puede cubrir
   * candidatos de varias cargas, y entonces de varias órdenes: el papel de esa
   * factura las nombra a todas. Vacío en una orden común.
   */
  reune?: string[];
  filas: FilaOrden[];
  total: number;
  notas: string | null;
};

export const pesosDeOrden = (n: number) =>
  `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const BAJADA = ['Estructura inteligente', 'Potencial humano', 'Impacto medible'];
export const SITIO = 'www.camposhr.com';

/** Cómo se nombra el dólar de referencia en la nota: cambia entre la hoja y la pantalla. */
export const REFERENCIA_EN_LA_HOJA = 'el de la fecha de emisión';

/** Las aclaraciones de los renglones, sin repetir. */
export function notasDe(filas: FilaOrden[]): string[] {
  return [...new Set(filas.map((r) => r.nota).filter(Boolean))];
}

/**
 * Las condiciones comerciales que van al pie de toda orden.
 *
 * Son las mismas para todos los clientes y por eso están escritas acá y no en
 * cada orden.
 */
export const CONDICIONES: { rotulo: string; texto: string }[] = [
  { rotulo: 'Comprobante', texto: 'Se emite factura C.' },
  { rotulo: 'Forma de pago', texto: 'Transferencia bancaria.' },
  { rotulo: 'Vencimiento', texto: '7 días desde la fecha de emisión.' },
  { rotulo: 'Actualización', texto: 'Pasado el vencimiento, el importe se ajusta por IPC.' },
];

/** Lo que pasa después de cargar un pedido, para la pantalla de confirmación. */
export const PASOS_SIGUIENTES = [
  'Asignamos una evaluadora.',
  'Contactamos a cada candidato para coordinar la entrevista.',
  'Cuando el informe está listo, aparece en tu portal.',
];

/**
 * Lo que cambia entre los papeles que comparten la misma hoja: la orden de
 * compra, el recibo de pago y la factura que todavía no tiene CAE. Son el
 * mismo diseño con otro título, otros datos arriba y otro cierre.
 */
export type FormaDelPapel = {
  titulo: string;
  /** Lo que va delante del número: "#" en la orden, "N°" en la factura. */
  prefijo?: string;
  /** Las líneas de datos de debajo del título, en orden. */
  datos: { rotulo: string; valor: string }[];
  rotuloTotal: string;
  /** El bloque del pie: "Condiciones" en la orden, "Pago" en el recibo. */
  cierre: { titulo: string; lineas: { rotulo: string; texto: string }[] };
  /** Cómo empieza el nombre del archivo. */
  archivo: string;
};

/** La forma de la orden de compra. */
export function formaDeOrden(orden: Orden): FormaDelPapel {
  return {
    titulo: 'Orden de compra',
    datos: [
      { rotulo: 'Cliente', valor: orden.cliente },
      ...(orden.solicitantes.length > 0
        ? [{ rotulo: 'Solicitado por', valor: orden.solicitantes.join(' · ') }]
        : []),
      { rotulo: 'Fecha de emisión', valor: formatoFecha(orden.fecha) },
      { rotulo: 'Estado', valor: orden.estado },
      // Cuando el papel junta varias órdenes, las nombra.
      ...(orden.reune && orden.reune.length > 1
        ? [{ rotulo: 'Reúne las órdenes', valor: orden.reune.map((n) => `#${n}`).join(', ') }]
        : []),
      // La del cliente, cuando la tiene: es otro número que el de este papel.
      ...(orden.referencia ? [{ rotulo: 'Referencia del cliente', valor: orden.referencia }] : []),
    ],
    rotuloTotal: 'Total',
    cierre: {
      titulo: 'Condiciones',
      lineas: [...CONDICIONES, ...(orden.notas ? [{ rotulo: 'Notas', texto: orden.notas }] : [])],
    },
    archivo: 'Orden de compra',
  };
}

/**
 * La forma del recibo de pago: qué se pagó, cuándo y contra qué comprobante.
 * `comprobante` nombra la factura y las órdenes de compra que cubre.
 */
export function formaDelRecibo(
  papel: Orden,
  pagadoEl: string,
  comprobante: string | null,
  formaPago: string | null = null
): FormaDelPapel {
  return {
    titulo: 'Recibo de pago',
    datos: [
      { rotulo: 'Recibimos de', valor: papel.cliente },
      { rotulo: 'Fecha de pago', valor: formatoFecha(pagadoEl) },
      ...(comprobante ? [{ rotulo: 'Corresponde a', valor: comprobante }] : []),
      ...(papel.referencia ? [{ rotulo: 'Referencia del cliente', valor: papel.referencia }] : []),
    ],
    rotuloTotal: 'Total pagado',
    cierre: {
      titulo: 'Pago',
      lineas: [
        // Se elige al marcar el cobro; sin dato es transferencia, que es como
        // entraron todos los anteriores.
        { rotulo: 'Forma de pago', texto: formaPago === 'efectivo' ? 'Efectivo.' : 'Transferencia bancaria.' },
        { rotulo: 'Estado', texto: 'Pagado. No queda saldo pendiente por este trabajo.' },
      ],
    },
    archivo: 'Recibo de pago',
  };
}
