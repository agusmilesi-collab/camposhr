import { redirect } from 'next/navigation';

/**
 * Seguimiento es ahora la segunda columna de Entregados.
 *
 * Los enlaces viejos siguen andando: la ficha vuelve por acá cuando se abrió
 * desde esa etapa.
 */
export default function Vieja() {
  redirect('/os/psicotecnicos/entregados');
}
