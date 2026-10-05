import { NextResponse } from 'next/server';
import { verOrden } from '@/lib/orden-compra';
import { archivoDeOrden, pdfDeOrden } from '@/lib/orden-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * La orden de compra en PDF, para el cliente.
 *
 * No tiene sesión: el token de la orden es toda la credencial, y solo abre esa
 * orden. Es el enlace del botón de la pantalla de confirmación, y el que va a
 * ir en el correo.
 */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  // Solo por token: con el identificador entra el equipo, por la ruta del OS.
  const orden = params.token.startsWith('oc_') ? await verOrden(params.token) : null;
  if (!orden) return NextResponse.json({ error: 'Esa orden no existe.' }, { status: 404 });

  return new NextResponse(Buffer.from(await pdfDeOrden(orden)), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${archivoDeOrden(orden)}"`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
