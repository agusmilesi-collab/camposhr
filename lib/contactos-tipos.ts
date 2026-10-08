/**
 * Quién es quién del lado del cliente.
 *
 * Un cliente tiene varias personas y hacen cosas distintas: una o varias piden
 * las evaluaciones, y otra recibe la factura y paga. Antes era un campo de
 * texto suelto en la empresa, sin mail y sin lugar para el segundo.
 *
 * **Las dos cosas no se excluyen**: en una empresa chica la misma persona pide
 * y paga, así que son dos marcas y no un rol único.
 *
 * El mail es lo que va a usar el aviso automático: quien pide una evaluación
 * desde el portal recibe la confirmación de su solicitud.
 *
 * Sin `server-only`: lo lee la pantalla que lo edita.
 */

export type Contacto = {
  id: string;
  nombre: string;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  /** Pide evaluaciones. Es quien figura en el portal al cargar un pedido. */
  pide: boolean;
  /**
   * Es responsable de compras: recibe las facturas y los recibos de pago de
   * toda la empresa. Si la empresa no tiene ninguno, van a quien solicitó.
   */
  facturacion: boolean;
  /** Recibe por correo la orden de compra, al cargar candidatos. */
  recibeOrden: boolean;
  /** Recibe el aviso de que la entrevista quedó agendada. */
  recibeEntrevista: boolean;
  /** Recibe el aviso de que el informe está en el portal. */
  recibeInforme: boolean;
  /**
   * Recibe también lo de los candidatos que pidieron otros de su empresa. Sin
   * esto recibe solo lo de los que pidió él.
   */
  recibeTodo: boolean;
  activo: boolean;
};

/** Cómo se lo nombra en una línea: el nombre, y el cargo si está cargado. */
export function comoSeLlama(c: Contacto): string {
  return c.cargo ? `${c.nombre} · ${c.cargo}` : c.nombre;
}

/**
 * Los avisos que recibe quien solicita, en el orden en que pasan.
 *
 * La factura no está acá: no se tilda por aviso, la recibe el responsable de
 * compras (`facturacion`) y, si no hay ninguno, quien solicitó el candidato.
 */
export const AVISOS = [
  { campo: 'recibeOrden', texto: 'Orden de compra', fila: 'Orden' },
  { campo: 'recibeEntrevista', texto: 'Entrevista agendada', fila: 'Entrevista' },
  { campo: 'recibeInforme', texto: 'Informe listo', fila: 'Informe' },
] as const;

/** Qué hace, dicho para leer de un vistazo. */
export function queHace(c: Contacto): string {
  if (c.pide && c.facturacion) return 'Pide evaluaciones y recibe la factura';
  if (c.facturacion) return 'Recibe la factura';
  if (c.pide) return 'Pide evaluaciones';
  return 'Recibe avisos';
}
