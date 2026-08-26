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
  /** Recibe la factura. */
  facturacion: boolean;
  activo: boolean;
};

/** Cómo se lo nombra en una línea: el nombre, y el cargo si está cargado. */
export function comoSeLlama(c: Contacto): string {
  return c.cargo ? `${c.nombre} · ${c.cargo}` : c.nombre;
}

/** Qué hace, dicho para leer de un vistazo. */
export function queHace(c: Contacto): string {
  if (c.pide && c.facturacion) return 'Pide evaluaciones y recibe la factura';
  if (c.facturacion) return 'Recibe la factura';
  if (c.pide) return 'Pide evaluaciones';
  return 'Sin rol';
}
