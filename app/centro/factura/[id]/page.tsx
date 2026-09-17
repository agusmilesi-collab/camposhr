import { notFound, redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import { verFactura } from '@/lib/facturas';
import Comprobante from '@/app/os/psicotecnicos/facturacion/comprobante/[id]/Comprobante';

export const dynamic = 'force-dynamic';

/**
 * La factura del inquilino, desde su portal.
 *
 * Es el mismo comprobante que ve el equipo en el OS: un solo documento, para
 * que lo que descarga el inquilino sea exactamente lo que se emitió.
 *
 * **Se comprueba de quién es la factura contra la persona de la cookie**, y no
 * contra un identificador que venga en la dirección: con la dirección sola,
 * cambiar el id mostraría la factura de otro.
 */
export default async function FacturaDelInquilino({ params }: { params: { id: string } }) {
  const yo = await inquilinoDeLaSesion();
  if (!yo) redirect('/centro/entrar');

  const factura = await verFactura(params.id);
  if (!factura || factura.inquilinoId !== yo.id) notFound();

  return <Comprobante id={params.id} />;
}
