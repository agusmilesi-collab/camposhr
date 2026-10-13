import { redirect } from 'next/navigation';

/**
 * Costos dejó de ser una pantalla: los servicios de Campos HR se miran en
 * Cotizaciones, debajo del embudo, y el monotributo es una pestaña de
 * Facturación. La dirección queda para quien la tenga guardada.
 */
export default function Costos() {
  redirect('/os/psicotecnicos/facturacion?ver=monotributo');
}
