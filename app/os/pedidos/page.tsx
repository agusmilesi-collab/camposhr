import { redirect } from 'next/navigation';

/**
 * Los pedidos dejaron de ser una sección.
 *
 * Viven adentro de su cliente desde el 25/8/2026: una búsqueda no existe sin
 * quien la pidió, y en dos pantallas había que cruzar de memoria qué pedido era
 * de quién. La ficha de cada pedido sigue donde estaba, `/os/pedidos/<id>`; lo
 * que se va es la lista.
 *
 * La redirección queda porque la dirección está guardada en marcadores y porque
 * el botón de volver de la ficha del pedido apunta acá.
 */
export default function Pedidos() {
  redirect('/os/clientes');
}
