import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { pdfParaBajar } from '@/lib/factura-archivo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * La factura o la nota de crédito en PDF, con sus tres ejemplares.
 *
 * Si tiene CAE, es el archivo que se guardó al autorizarla. Si no, se arma en
 * el momento con lo que hay anotado.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }
  const pdf = await pdfParaBajar(params.id);
  if (!pdf) return NextResponse.json({ error: 'Esa factura no existe.' }, { status: 404 });
  return new NextResponse(Buffer.from(pdf.bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdf.nombre}"`,
      'Cache-Control': 'no-store',
    },
  });
}
