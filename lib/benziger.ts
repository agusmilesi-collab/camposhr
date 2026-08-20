/**
 * Cuánto cuesta el Benziger, y por qué está solo en este archivo.
 *
 * Es opcional en las tres baterías y se compra por búsqueda: el cliente decide
 * una vez si esa evaluación lleva Benziger, y vale para todos los candidatos
 * de ese pedido (`pedidos.con_benziger`).
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
