import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { ordenPorId } from '@/lib/orden-compra';
import { archivoDeOrden, pdfDeOrden } from '@/lib/orden-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * La orden de compra en PDF, para el equipo.
 *
 * Recibe el identificador de una orden o, por las que se hicieron antes de que
 * la orden naciera con la carga de candidatos, el de la fila de `facturas`
 * marcada "sin comprobante". La ruta se sigue llamando "recibo" porque es el
 * nombre con el que nació y hay enlaces guardados.
 *
 * El cliente la baja por otra puerta, con su token: `/api/portal/orden/<token>`.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }
  const orden = await ordenPorId(params.id);
  if (!orden) return NextResponse.json({ error: 'Esa orden no existe.' }, { status: 404 });

  return new NextResponse(Buffer.from(await pdfDeOrden(orden)), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${archivoDeOrden(orden)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
