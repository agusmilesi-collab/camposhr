import { redirect } from 'next/navigation';

/** Citar y entrevistar se unieron en Entrevistas. Los enlaces viejos siguen andando. */
export default function Vieja() {
  redirect('/os/psicotecnicos/entrevistas');
}
