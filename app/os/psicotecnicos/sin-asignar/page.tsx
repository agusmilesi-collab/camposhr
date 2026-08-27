import { redirect } from 'next/navigation';

/**
 * Repartir dejó de ser su propia pantalla y es la primera columna de
 * Entrevistas. Los enlaces viejos siguen andando: la ficha vuelve por acá
 * cuando se abrió desde el reparto.
 */
export default function Vieja() {
  redirect('/os/psicotecnicos/entrevistas');
}
