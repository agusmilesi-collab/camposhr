import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Ruteo por host. Tres zonas:
 *
 *  clientes.camposhr.com  -> portal de clientes (exclusivo).
 *     /<token>  se reescribe a /p/<token> (URL limpia); nada más existe acá.
 *
 *  tools.camposhr.com     -> hub interno (equipo): landing de herramientas,
 *     tests Rorschach/Zulliger e /informes (accesos de clientes).
 *
 *  camposhr.com (y www)   -> liberado para el site comercial.
 *     La raíz muestra un placeholder; las herramientas viejas y los enlaces
 *     de portal redirigen a su subdominio nuevo.
 */

const CLIENT_HOST = 'clientes.camposhr.com';
const TOOLS_HOST = 'tools.camposhr.com';

const TOKEN = /^\/([A-Za-z0-9_-]+)\/?$/;
const TOKEN_EN_P = /^\/p\/([A-Za-z0-9_-]+)\/?$/;
const RUTAS_TOOLS = /^\/(test-rorschach|test-zulliger|informes|cuestionario)(\/|$)/;

// El cuestionario se responde desde el host principal: /c/<empresa>, más su
// endpoint de guardado. Son las únicas rutas públicas de la app.
const RUTAS_PUBLICAS = /^\/(c|l|api\/cuestionario)\//;

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const url = req.nextUrl;
  const { pathname } = url;

  // --- Desarrollo local: todas las zonas conviven en localhost ---
  // Sin esto, las rutas de tools redirigen al subdominio y no se pueden probar.
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    if (pathname === '/') {
      const dest = url.clone();
      dest.pathname = '/index.html';
      return NextResponse.rewrite(dest);
    }
    return NextResponse.next();
  }

  // --- Portal de clientes: subdominio exclusivo ---
  if (host === CLIENT_HOST) {
    if (pathname.startsWith('/p/')) return NextResponse.next();
    const m = pathname.match(TOKEN);
    if (m) {
      const dest = url.clone();
      dest.pathname = `/p/${m[1]}`;
      return NextResponse.rewrite(dest);
    }
    return new NextResponse('No autorizado.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  // --- Hub interno de herramientas ---
  if (host === TOOLS_HOST) {
    if (pathname === '/') {
      const dest = url.clone();
      dest.pathname = '/index.html';
      return NextResponse.rewrite(dest);
    }
    return NextResponse.next();
  }

  // --- Host principal: liberado para el site comercial ---
  // El cuestionario público vive acá (es el destino de los QR).
  if (RUTAS_PUBLICAS.test(pathname)) return NextResponse.next();

  // Raíz -> placeholder.
  if (pathname === '/') {
    const dest = url.clone();
    dest.pathname = '/proximamente.html';
    return NextResponse.rewrite(dest);
  }
  // Herramientas viejas -> se mudaron a tools.camposhr.com.
  if (RUTAS_TOOLS.test(pathname) || pathname === '/index.html') {
    return NextResponse.redirect(`https://${TOOLS_HOST}${pathname}`, 307);
  }
  // Enlaces viejos del portal -> subdominio de clientes.
  const m = pathname.match(TOKEN_EN_P);
  if (m) {
    return NextResponse.redirect(`https://${CLIENT_HOST}/${m[1]}`, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|_next/data|favicon.ico).*)'],
};
