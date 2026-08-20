import { redirect } from 'next/navigation';
import { RUTA } from '@/lib/psicotecnicos';

/** La sección se llama Psicotécnicos. Los enlaces viejos siguen andando. */
export default function Evaluaciones() {
  redirect(`/os/psicotecnicos/${RUTA['Sin asignar']}`);
}
