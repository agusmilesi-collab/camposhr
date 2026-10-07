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
  /** Recibe por correo la factura y su recibo de pago. */
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

/** Los correos que se le pueden mandar, en el orden en que pasan. */
export const AVISOS = [
  { campo: 'recibeOrden', texto: 'Orden de compra', fila: 'Orden', corto: 'orden' },
  { campo: 'recibeEntrevista', texto: 'Entrevista agendada', fila: 'Entrevista', corto: 'entrevista' },
  { campo: 'recibeInforme', texto: 'Informe listo', fila: 'Informe', corto: 'informe' },
  { campo: 'facturacion', texto: 'Factura y recibo de pago', fila: 'Factura', corto: 'factura' },
] as const;

/** Qué recibe por correo, en una línea: "orden, informe, factura · de toda la empresa". */
export function queRecibe(c: Contacto): string {
  const cuales = AVISOS.filter((a) => c[a.campo]).map((a) => a.corto);
  if (cuales.length === 0) return 'Sin correos';
  const todos = cuales.length === AVISOS.length ? 'todo' : cuales.join(', ');
  return c.recibeTodo ? `${todos} · de toda la empresa` : todos;
}

/** Qué hace, dicho para leer de un vistazo. */
export function queHace(c: Contacto): string {
  if (c.pide && c.facturacion) return 'Pide evaluaciones y recibe la factura';
  if (c.facturacion) return 'Recibe la factura';
  if (c.pide) return 'Pide evaluaciones';
  return 'Recibe avisos';
}
