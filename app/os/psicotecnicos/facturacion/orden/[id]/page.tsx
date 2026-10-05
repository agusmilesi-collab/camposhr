import { notFound } from 'next/navigation';
import HojaPapel from '@/app/_components/HojaPapel';
import { ordenPorId } from '@/lib/orden-compra';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Orden de compra — Campos OS' };

/**
 * La orden de compra, en pantalla. Lo que el cliente recibe es el PDF
 * (`/api/os/recibo/<id>` para el equipo, `/api/portal/orden/<token>` para él);
 * acá está la misma hoja en HTML, que es donde se decide el diseño.
 */
export default async function Orden({ params }: { params: { id: string } }) {
  const orden = await ordenPorId(params.id);
  if (!orden) notFound();
  return <HojaPapel orden={orden} />;
}
