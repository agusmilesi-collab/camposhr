import { redirect } from 'next/navigation';
import { RUTA } from '@/lib/psicotecnicos';

/**
 * La sección abre en el reparto.
 *
 * Antes acá había un resumen con el panorama de la semana. Lo que mostraba ya
 * está a la vista en otro lado: las cuentas por etapa viven en la barra
 * lateral y el panorama del trabajo abierto, en el inicio del OS. Entrar a
 * psicotécnicos lleva directamente a lo primero que hay que hacer, que es
 * repartir lo que no tiene dueño.
 */
export default function Psicotecnicos() {
  redirect(`/os/psicotecnicos/${RUTA['Sin asignar']}`);
}
