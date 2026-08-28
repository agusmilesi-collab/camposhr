/**
 * Cuánto cuesta el Benziger, y por qué está solo en este archivo.
 *
 * Es opcional en las tres baterías y se compra por búsqueda: el cliente decide
 * una vez si esa evaluación lleva Benziger, y vale para todos los candidatos
 * de ese pedido (`pedidos.con_benziger`). Un candidato suelto puede llevarlo
 * igual (`evaluaciones.con_benziger`), que es lo que pasa cuando lo pide la
 * evaluadora o cuando un pedido con la marca se fusiona con otro que no la
 * tiene.
 *
 * Cuarenta dólares, pesificados al dólar tarjeta del día: es lo que cuesta la
 * licencia por aplicación y se paga afuera. Por eso no entra en la historia de
 * precios de las baterías: no lo actualizamos nosotros sino el tipo de cambio.
 *
 * Vive suelto y sin `server-only` porque también lo muestran las pantallas del
 * navegador, y `lib/baterias-precios.ts` lee de Supabase y no se puede
 * importar desde ahí.
 */
export const BENZIGER_USD = 40;

/**
 * Si a esta evaluación le corresponde el Benziger.
 *
 * Tres formas de llevarlo y las tres valen: lo compró el pedido, se le pidió a
 * esta persona en particular, o ya se le tomó. La cuenta está acá y no en cada
 * pantalla porque de los cinco lugares que la hacían, cada uno se enteraba de
 * la marca nueva por separado.
 */
export function llevaBenziger(f: {
  con_benziger?: boolean | null;
  benziger_administrado?: boolean | null;
  pedidos?: { con_benziger?: boolean | null } | null;
}): boolean {
  return Boolean(f.con_benziger || f.benziger_administrado || f.pedidos?.con_benziger);
}
