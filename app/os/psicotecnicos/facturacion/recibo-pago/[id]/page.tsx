import { notFound } from 'next/navigation';
import HojaPapel from '@/app/_components/HojaPapel';
import { formaDelRecibo, reciboDePago } from '@/lib/orden-compra';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Recibo de pago — Campos OS' };

/**
 * El recibo de pago, en pantalla. Es la misma hoja de la orden de compra con
 * la forma del recibo; el PDF que se le manda al cliente sale de
 * `/api/os/recibo-pago/<id>`.
 */
export default async function Recibo({ params }: { params: { id: string } }) {
  const recibo = await reciboDePago(params.id);
  if (!recibo) notFound();
  return (
    <HojaPapel
      orden={recibo.papel}
      forma={formaDelRecibo(recibo.papel, recibo.pagadoEl, recibo.comprobante)}
    />
  );
}
