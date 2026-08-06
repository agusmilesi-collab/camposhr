import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Ruteo por host. Tres zonas:
 *
 *  clientes.camposhr.com  -> portal de clientes (exclusivo).
 *     /<token>  se reescribe a /p/<token> (URL limpia); nada más existe acá.
 *
 *  tools.camposhr.com     -> hub interno (equipo): landing de herramientas,
 *     tests Rorschach/Zulliger e /informes (accesos de clientes). Acá viven
 *     también las presentaciones de los encuentros: /pres/<token> sirve el
 *     archivo de la charla.
 *
 *  camposhr.com (y www)   -> site comercial.
 *     La raíz muestra la home; las herramientas viejas y los enlaces de portal
 *     redirigen a su subdominio nuevo. Acá viven también las cotizaciones que
 *     se mandan al cliente: /q/<token> sirve su documento.
 */

const CLIENT_HOST = 'clientes.camposhr.com';
const TOOLS_HOST = 'tools.camposhr.com';
// Prototipo de interfaz del hub. Vive en public/v2/ y se ve en su propio
// subdominio o en <host>/v2. No tiene datos reales ni acciones conectadas.
const TOOLS_V2_HOST = 'toolsversion2.camposhr.com';

const TOKEN = /^\/([A-Za-z0-9_-]+)\/?$/;
const TOKEN_EN_P = /^\/p\/([A-Za-z0-9_-]+)\/?$/;
const RUTAS_TOOLS = /^\/(test-rorschach|test-zulliger|informes|cuestionario|cotizaciones|presentaciones|pres|encuentros)(\/|$)/;

// Cotización enviada a un cliente: /q/<token> -> el documento estático que vive
// en public/q/<token>.html. El token es secreto y la página lleva noindex.
const COTIZACION = /^\/q\/([A-Za-z0-9_-]{6,128})\/?$/;

// Presentación de un encuentro: /pres/<token> -> el archivo estático que vive
// en public/pres/<token>.html. Mismo criterio que las cotizaciones: el token es
// secreto y la presentación lleva noindex.
const PRESENTACION = /^\/pres\/([A-Za-z0-9_-]{6,128})\/?$/;

// Lo que se responde desde el teléfono vive en el host principal, porque es el
// destino de los códigos QR: el cuestionario en /c/<empresa> y el ciclo de
// encuentros en /ciclo/<empresa>, cada uno con su endpoint de guardado.
const RUTAS_PUBLICAS = /^\/(c|l|ciclo|api\/cuestionario|api\/ciclo)\//;

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
    const q = pathname.match(COTIZACION);
    if (q) {
      const dest = url.clone();
      dest.pathname = `/q/${q[1]}.html`;
      return NextResponse.rewrite(dest);
    }
    const pr = pathname.match(PRESENTACION);
    if (pr) {
      const dest = url.clone();
      dest.pathname = `/pres/${pr[1]}.html`;
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

  // --- Prototipo del hub (solo para mirar la interfaz) ---
  if (host === TOOLS_V2_HOST) {
    if (pathname === '/') {
      const dest = url.clone();
      dest.pathname = '/v2/index.html';
      return NextResponse.rewrite(dest);
    }
    return NextResponse.next();
  }

  // --- Hub interno de herramientas ---
  if (host === TOOLS_HOST) {
    if (pathname === '/') {
      const dest = url.clone();
      dest.pathname = '/index.html';
      return NextResponse.rewrite(dest);
    }
    const pr = pathname.match(PRESENTACION);
    if (pr) {
      const dest = url.clone();
      dest.pathname = `/pres/${pr[1]}.html`;
      return NextResponse.rewrite(dest);
    }
    return NextResponse.next();
  }

  // --- Host principal: el site comercial ---
  // El cuestionario público vive acá (es el destino de los QR).
  if (RUTAS_PUBLICAS.test(pathname)) return NextResponse.next();

  // Cotización del cliente: URL limpia sobre el archivo estático.
  const q = pathname.match(COTIZACION);
  if (q) {
    const dest = url.clone();
    dest.pathname = `/q/${q[1]}.html`;
    return NextResponse.rewrite(dest);
  }

  // Raíz -> home comercial.
  if (pathname === '/') {
    const dest = url.clone();
    dest.pathname = '/home.html';
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
