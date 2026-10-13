import { NextResponse } from 'next/server';
import { leerCotizacion } from '@/lib/documentos-portal';

export const dynamic = 'force-dynamic';

/**
 * La cotización que se le manda a un cliente: camposhr.com/q/<token>.
 *
 * El token es el secreto. El documento sale del bucket privado y no de
 * `public/`: ahí el enlace quedaba escrito en el nombre del archivo, y el
 * repositorio es público.
 */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const html = await leerCotizacion(params.token);
  if (html === null) {
    return new NextResponse('No encontrado.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' },
    });
  }
  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'private, no-store',
    },
  });
}
