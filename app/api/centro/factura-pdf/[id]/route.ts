import { NextResponse } from 'next/server';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import { verFactura } from '@/lib/facturas';
import { pdfParaBajar } from '@/lib/factura-archivo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * La factura propia, en PDF.
 *
 * Es el mismo archivo que baja el equipo desde el OS. Se comprueba de quién es
 * contra la persona de la cookie firmada: con el identificador solo, cambiarlo
 * en la dirección bajaría la factura de otro.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const yo = await inquilinoDeLaSesion();
  if (!yo) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const factura = await verFactura(params.id).catch(() => null);
  if (!factura || factura.inquilinoId !== yo.id) {
    return NextResponse.json({ error: 'Esa factura no existe.' }, { status: 404 });
  }
  const pdf = await pdfParaBajar(params.id);
  if (!pdf) return NextResponse.json({ error: 'Esa factura no existe.' }, { status: 404 });
  return new NextResponse(Buffer.from(pdf.bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${pdf.nombre}"`,
      'Cache-Control': 'no-store',
    },
  });
}
