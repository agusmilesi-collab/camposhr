import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { sesionPorToken } from '@/lib/raven-test';
import { OPCIONES, RAVEN_MAXIMO } from '@/lib/raven';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Las piezas de una lámina del Raven, para quien está rindiendo.
 *
 * Van por partes y no como una imagen entera: la matriz arriba y cada opción
 * por su lado, para que las ocho se puedan tocar. Antes eran un dibujo con los
 * números adentro y había que elegir el número en otro lado.
 *
 * El que entra no tiene sesión del OS: es la persona evaluada, y su token es
 * toda la credencial. Sin token válido no sale nada, porque el material tiene
 * derechos y una lámina que circula deja de servir para quien ya la vio.
 *
 * La otra puerta es la sesión del OS, para la vista de prueba: el equipo mira
 * el test como lo ve el candidato sin que exista ninguna sesión de Raven.
 *
 * Son recortes del escaneo y no dibujos. Vectorizarlas se probó y se descartó:
 * el trazo copia también los defectos del papel, y el escaneo es de 124 DPI, o
 * sea que el óvalo de una opción mide 51 píxeles y su contorno cuatro. Con ese
 * material, la copia más exacta es el recorte. Para verlas más nítidas hay que
 * volver a escanear, no redibujar.
 */

const BUCKET = 'psicotecnicos';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const n = Number(url.searchParams.get('n'));
  const parte = url.searchParams.get('parte') ?? 'matriz';

  if (!Number.isInteger(n) || n < 1 || n > RAVEN_MAXIMO) {
    return new NextResponse('No existe esa lámina.', { status: 404 });
  }
  // La matriz, o una de las ocho opciones. Nada más.
  const archivo =
    parte === 'matriz'
      ? 'matriz'
      : /^[1-8]$/.test(parte) && Number(parte) <= OPCIONES
        ? `opcion-${parte}`
        : null;
  if (!archivo) return new NextResponse('No existe esa parte.', { status: 404 });

  const entra = token
    ? Boolean(await sesionPorToken(token))
    : await conSesionDelOs(req);
  if (!entra) return new NextResponse('Sin sesión.', { status: 401 });

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!base || !key) return new NextResponse('Sin configuración.', { status: 500 });

  const ruta = `laminas/raven/${String(n).padStart(2, '0')}-${archivo}.png`;
  const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${ruta}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('raven lamina:', ruta, res.status);
    return new NextResponse('No está esa lámina.', { status: 404 });
  }

  const svg = await res.arrayBuffer();
  const cabeceras: Record<string, string> = {
    'Content-Type': 'image/png',
    // Se guarda en el navegador por una hora. Durante el test se va y se vuelve
    // a las láminas todo el tiempo, y preguntar antes de usar lo guardado son
    // nueve idas y vueltas por lámina: las figuras aparecían de a una. Una
    // lámina no cambia en mitad de un test, y el ETag sigue estando para cuando
    // caduque.
    'Cache-Control': 'private, max-age=3600',
  };
  const etag = res.headers.get('etag');
  if (etag) {
    cabeceras.ETag = etag;
    if (req.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers: cabeceras });
    }
  }
  return new NextResponse(svg, { headers: cabeceras });
}

/**
 * Si quien pide es alguien del equipo.
 *
 * Con la puerta puesta, su cookie. Sin puerta, que venga del subdominio del OS,
 * que ya es interno: sin esta segunda condición, un pedido sin token desde el
 * sitio público bajaba las láminas, que es material con derechos.
 */
async function conSesionDelOs(req: Request): Promise<boolean> {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const interno = host.startsWith('os.') || host.startsWith('localhost') || host.startsWith('127.0.0.1');
  if (!hayPuerta()) return interno;
  const clave = process.env.OS_CLAVE as string;
  const cookie = cookies().get(COOKIE)?.value;
  return interno && Boolean(cookie) && igual(cookie as string, await huella(clave));
}
