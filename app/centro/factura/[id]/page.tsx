import { notFound, redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import { verFactura } from '@/lib/facturas';

export const dynamic = 'force-dynamic';

/**
 * La factura del inquilino, desde una dirección vieja: lleva al PDF.
 *
 * Mostraba el comprobante del OS, con botones a rutas del OS que en el host
 * del Centro dan 404, y también facturas en borrador. Ahora manda al PDF
 * (`/api/centro/factura-pdf`), que es lo mismo que baja Mi cuenta.
 *
 * **Se comprueba de quién es la factura contra la persona de la cookie**, y no
 * contra un identificador que venga en la dirección: con la dirección sola,
 * cambiar el id mostraría la factura de otro.
 */
export default async function FacturaDelInquilino(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const yo = await inquilinoDeLaSesion();
  if (!yo) redirect('/centro/entrar');

  const factura = await verFactura(params.id);
  if (!factura || factura.inquilinoId !== yo.id || factura.estado !== 'emitida') notFound();

  redirect(`/api/centro/factura-pdf/${params.id}`);
}
