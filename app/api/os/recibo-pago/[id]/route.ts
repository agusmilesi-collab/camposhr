import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { formaDelRecibo, reciboDePago } from '@/lib/orden-compra';
import { archivoDeOrden, pdfDeOrden } from '@/lib/orden-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El recibo de pago en PDF: lo que se le da al cliente cuando entra la plata.
 *
 * Es la misma hoja de la orden de compra con otro título y otros datos: qué se
 * pagó, cuándo y contra qué comprobante. Se baja al confirmar el cobro en
 * Facturación, y después desde el botón "Recibo" de la fila.
 *
 * Solo existe para lo cobrado: sin pago no hay de qué dar recibo.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }
  const recibo = await reciboDePago(params.id);
  if (!recibo) {
    return NextResponse.json({ error: 'Ese cobro no está marcado.' }, { status: 404 });
  }
  const { papel, pagadoEl, comprobante } = recibo;

  const forma = formaDelRecibo(papel, pagadoEl, comprobante);

  return new NextResponse(Buffer.from(await pdfDeOrden(papel, forma)), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${archivoDeOrden(papel, forma.archivo)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
