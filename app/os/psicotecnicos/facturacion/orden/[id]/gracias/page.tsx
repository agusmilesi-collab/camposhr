import { notFound } from 'next/navigation';
import OrdenGracias from '@/app/_components/OrdenGracias';
import { ordenPorId } from '@/lib/orden-compra';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pedido recibido — Campos HR' };

/**
 * La pantalla de confirmación, vista desde el OS con una orden cualquiera.
 *
 * Donde vive de verdad es al final del formulario de pedido del portal. Esta
 * dirección es para mirarla y corregirla sin tener que cargar un pedido cada
 * vez.
 */
export default async function Gracias({ params }: { params: { id: string } }) {
  const orden = await ordenPorId(params.id);
  if (!orden) notFound();
  return (
    <OrdenGracias
      orden={orden}
      pdf={orden.token ? `/api/portal/orden/${orden.token}` : `/api/os/recibo/${orden.id}`}
      volver="#"
    />
  );
}
