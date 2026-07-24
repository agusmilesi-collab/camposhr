import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Ruteo por host.
 *
 * clientes.camposhr.com  -> subdominio EXCLUSIVO del portal de clientes.
 *   - /<token>           se reescribe a /p/<token> (URL limpia en el navegador)
 *   - /p/<token>         pasa directo (compatibilidad)
 *   - cualquier otra cosa (raíz, tests, archivos estáticos) no existe acá
 *
 * camposhr.com (y demás)  -> sitio de herramientas normal.
 *   - /p/<token>         redirige al subdominio con el formato nuevo, para que
 *                        los enlaces viejos sigan funcionando
 */

const CLIENT_HOST = 'clientes.camposhr.com';
const TOKEN = /^\/([A-Za-z0-9_-]+)\/?$/;
const TOKEN_EN_P = /^\/p\/([A-Za-z0-9_-]+)\/?$/;

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const url = req.nextUrl;
  const { pathname } = url;

  if (host === CLIENT_HOST) {
    // El portal ya en su ruta interna: pasa directo.
    if (pathname.startsWith('/p/')) return NextResponse.next();

    // /<token> -> /p/<token> (reescritura, la URL visible no cambia).
    const m = pathname.match(TOKEN);
    if (m) {
      const dest = url.clone();
      dest.pathname = `/p/${m[1]}`;
      return NextResponse.rewrite(dest);
    }

    // Raíz y todo lo demás: en este subdominio no hay nada más que el portal.
    return new NextResponse('No autorizado.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  // Host principal: los enlaces viejos del portal se mudan al subdominio.
  const m = pathname.match(TOKEN_EN_P);
  if (m) {
    return NextResponse.redirect(`https://${CLIENT_HOST}/${m[1]}`, 307);
  }

  return NextResponse.next();
}

export const config = {
  // Corre en todo salvo los internos de Next y el favicon.
  matcher: ['/((?!_next/static|_next/image|_next/data|favicon.ico).*)'],
};
