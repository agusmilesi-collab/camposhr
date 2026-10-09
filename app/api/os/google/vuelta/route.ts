import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { canjear, guardarConexion, hayGoogle } from '@/lib/google-calendario';
import { ponerAlDia } from '@/lib/entrevista-agendada';
import { anotarAcceso } from '@/lib/accesos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Al conectar se sincronizan las entrevistas que ya estaban agendadas, y cada
// una son dos o tres llamadas a Google.
export const maxDuration = 60;

const VUELTA = '/os/configuracion?ver=calendario';

/**
 * A donde vuelve Google después de que la evaluadora autoriza (o no).
 *
 * Cambia el código por el permiso duradero, lo guarda y trae al calendario las
 * entrevistas que ya tenía agendadas.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const volver = (como: string) => {
    const res = NextResponse.redirect(`${url.origin}${VUELTA}&google=${como}`, 303);
    res.cookies.set('google_estado', '', { path: '/api/os/google', maxAge: 0 });
    return res;
  };

  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
    }
  }
  if (!hayGoogle()) return volver('fallo');

  // Apretó "Cancelar" en la pantalla de Google.
  if (url.searchParams.get('error')) return volver('rechazado');

  const [estado, evaluadora] = (cookies().get('google_estado')?.value ?? '').split(':');
  const codigo = url.searchParams.get('code');
  if (!estado || !evaluadora || !codigo || url.searchParams.get('state') !== estado) {
    return volver('fallo');
  }

  try {
    const canje = await canjear(codigo, url.origin);
    if (!canje.ok) return volver(canje.motivo);
    await guardarConexion(evaluadora, canje.refresh, canje.cuenta, canje.contactos);
    await anotarAcceso({
      accion: 'escritura',
      recurso: 'google_calendario',
      detalle: { evaluadora, conexion: 'conectada' },
    });
    await ponerAlDia(evaluadora);
    return volver('ok');
  } catch (e) {
    console.error('google vuelta:', e);
    return volver('fallo');
  }
}
