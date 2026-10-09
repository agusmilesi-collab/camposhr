import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { hayGoogle, urlDeAutorizacion } from '@/lib/google-calendario';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VUELTA = '/os/configuracion?ver=calendario';

/**
 * Manda a la evaluadora a la pantalla de Google donde autoriza su calendario.
 *
 * Deja una cookie con un valor al azar y de quién es la conexión. Google
 * devuelve ese valor en la vuelta: si no coincide con la cookie, el pedido no
 * salió de este navegador y se descarta.
 */
export async function GET(req: Request) {
  const origen = new URL(req.url).origin;
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
    }
  }

  const evaluadora = new URL(req.url).searchParams.get('evaluadora') ?? '';
  if (!hayGoogle() || !UUID.test(evaluadora)) {
    return NextResponse.redirect(`${origen}${VUELTA}&google=fallo`, 303);
  }

  const estado = crypto.randomUUID();
  const res = NextResponse.redirect(urlDeAutorizacion(origen, estado), 303);
  res.cookies.set('google_estado', `${estado}:${evaluadora}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: origen.startsWith('https://'),
    path: '/api/os/google',
    maxAge: 600,
  });
  return res;
}
