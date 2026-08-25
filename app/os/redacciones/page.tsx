import { redirect } from 'next/navigation';

/** Vivía suelta en la barra; ahora es una pestaña de Configuración. */
export default function Vieja() {
  redirect('/os/configuracion?ver=redacciones');
}
