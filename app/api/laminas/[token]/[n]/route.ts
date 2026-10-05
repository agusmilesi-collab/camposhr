import { NextResponse } from 'next/server';
import { leerLamina } from '@/lib/laminas';
import { testDelToken } from '@/lib/laminas-enlace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Una lámina, para la persona evaluada.
 *
 * No tiene sesión del OS: su token es toda la credencial, y vence. Sin token
 * vigente no sale nada, porque el material tiene derechos. La otra puerta, la
 * del equipo, es `/api/os/lamina`.
 */
export async function GET(req: Request, { params }: { params: { token: string; n: string } }) {
  const test = await testDelToken(params.token);
  if (!test) return new NextResponse('El enlace venció.', { status: 401 });

  const lamina = await leerLamina(test, Number(params.n));
  if (!lamina) return new NextResponse('No existe esa lámina.', { status: 404 });

  const cabeceras: Record<string, string> = {
    'Content-Type': lamina.tipo,
    'Cache-Control': 'private, max-age=300, must-revalidate',
    'X-Robots-Tag': 'noindex, nofollow',
  };
  if (lamina.etag) {
    cabeceras.ETag = lamina.etag;
    if (req.headers.get('if-none-match') === lamina.etag) {
      return new NextResponse(null, { status: 304, headers: cabeceras });
    }
  }
  return new NextResponse(lamina.imagen, { headers: cabeceras });
}
