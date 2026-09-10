import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { esTestConLaminas, leerLamina } from '@/lib/laminas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Una lámina, para quien tenga sesión del OS.
 *
 * No se registra el acceso: administrar un test son cientos de idas y vueltas
 * entre láminas, y una fila por cada una llenaría el registro sin decir nada
 * que no diga la evaluación misma.
 */
export async function GET(req: Request, { params }: { params: { test: string; n: string } }) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return new NextResponse('Sin sesión.', { status: 401 });
    }
  }

  if (!esTestConLaminas(params.test)) {
    return new NextResponse('No existe ese test.', { status: 404 });
  }

  const lamina = await leerLamina(params.test, Number(params.n));
  if (!lamina) return new NextResponse('No existe esa lámina.', { status: 404 });

  // El navegador la guarda cinco minutos y después pregunta. Con `no-cache`
  // preguntaba siempre, y esa vuelta pasa por el bucket antes de poder
  // contestar 304: al cambiar de lámina se veía un segundo la mancha anterior
  // con los contornos de la nueva encima. Cinco minutos alcanzan para
  // administrar el test de corrido, y son el tiempo que una pantalla abierta
  // podría seguir mostrando una lámina que se acaba de reemplazar.
  //
  // Privada, no compartida: la sirve la sesión del OS y no puede quedar en una
  // caché intermedia.
  const cabeceras: Record<string, string> = {
    'Content-Type': lamina.tipo,
    'Cache-Control': 'private, max-age=300, must-revalidate',
  };
  if (lamina.etag) {
    cabeceras.ETag = lamina.etag;
    if (req.headers.get('if-none-match') === lamina.etag) {
      return new NextResponse(null, { status: 304, headers: cabeceras });
    }
  }
  return new NextResponse(lamina.imagen, { headers: cabeceras });
}
