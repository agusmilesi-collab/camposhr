import { NextResponse } from 'next/server';
import { armarCookie, COOKIE, COOKIE_MIRANDO, idDelPase } from '@/lib/centro-cookie';
import { select } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Entrar a mirar la pantalla de un inquilino con un pase del OS.
 *
 * El pase lo firma el OS con `CENTRO_SECRETO` y vale dos minutos: se abre y se
 * gasta en el acto. Deja la misma cookie de sesión que la contraseña, más la
 * marca de "mirando", que es lo que bloquea toda escritura y muestra la banda.
 * La sesión dura lo que una pestaña: se va al cerrarla.
 */
export async function GET(_req: Request, props: { params: Promise<{ pase: string }> }) {
  const { pase } = await props.params;
  const secreto = process.env.CENTRO_SECRETO;
  const id = await idDelPase(pase, secreto);
  if (!id || !secreto) {
    return new NextResponse('El pase venció o no es válido. Volvé a abrirlo desde el OS.', {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  const filas = await select<{ id: string; hash: string | null; activo: boolean }>(
    'inquilinos',
    `select=id,hash,activo&id=eq.${id}`
  );
  const yo = filas[0];
  if (!yo || !yo.activo) {
    return new NextResponse('Ese inquilino no está activo.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const res = NextResponse.redirect(new URL('/centro/inicio', _req.url), 303);
  const comunes = { httpOnly: true, sameSite: 'lax' as const, secure: true, path: '/' };
  res.cookies.set(COOKIE, await armarCookie(yo.id, yo.hash, secreto), comunes);
  res.cookies.set(COOKIE_MIRANDO, '1', comunes);
  return res;
}
