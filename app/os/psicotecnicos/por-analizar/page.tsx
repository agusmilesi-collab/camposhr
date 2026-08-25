import { redirect } from 'next/navigation';

/**
 * Por analizar es ahora la tercera columna de Entrevistas.
 *
 * Los enlaces viejos siguen andando: la ficha vuelve por acá cuando se abrió
 * desde esa etapa, y el atajo está en los favoritos de las tres.
 */
export default function Vieja() {
  redirect('/os/psicotecnicos/entrevistas');
}
