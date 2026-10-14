import { NextResponse } from 'next/server';
import { hayPuerta, huella, igual } from '@/lib/os-sesion';
import { cookieDelOs } from '@/lib/os-sesion-servidor';
import { pdfParaBajar } from '@/lib/factura-archivo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * La factura o la nota de crédito en PDF, con sus tres ejemplares.
 *
 * Si tiene CAE, es el archivo que se guardó al autorizarla. Si no, se arma en
 * el momento con lo que hay anotado.
 *
 * Con `?ejemplar=original`, solo el original, en una hoja: para los portales
 * de proveedores que leen una factura por archivo.
 */
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = await cookieDelOs();
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }
  const soloOriginal = new URL(req.url).searchParams.get('ejemplar') === 'original';
  const pdf = await pdfParaBajar(params.id, soloOriginal);
  if (!pdf) return NextResponse.json({ error: 'Esa factura no existe.' }, { status: 404 });
  return new NextResponse(Buffer.from(pdf.bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdf.nombre}"`,
      'Cache-Control': 'no-store',
    },
  });
}
