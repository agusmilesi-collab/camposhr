import { NextResponse } from 'next/server';
import { claveCorrecta } from '@/lib/centro-acceso';
import { armarCookie, COOKIE, DURACION } from '@/lib/centro-cookie';
import { select } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * La entrada del inquilino: correo y contraseña.
 *
 * **El error es siempre el mismo.** Decir "ese correo no existe" le confirma a
 * cualquiera quién alquila en el Centro, que es justo lo que no tiene por qué
 * saberse desde afuera.
 *
 * Sin `CENTRO_SECRETO` no se entra. La zona falla cerrada porque adentro hay
 * plata y datos de terceros.
 */
export async function POST(req: Request) {
  const secreto = process.env.CENTRO_SECRETO;
  if (!secreto) {
    return NextResponse.json({ ok: false, motivo: 'El acceso todavía no está configurado.' }, { status: 503 });
  }

  const datos = await req.json().catch(() => null);
  const correo = String(datos?.correo ?? '').trim().toLowerCase();
  const clave = String(datos?.clave ?? '');
  if (!correo || !clave) {
    return NextResponse.json({ ok: false, motivo: 'Faltan el correo o la contraseña.' }, { status: 400 });
  }

  const filas = await select<{ id: string; hash: string | null; activo: boolean }>(
    'inquilinos',
    `select=id,hash,activo&correo=eq.${encodeURIComponent(correo)}`
  );
  const yo = filas[0];
  const entra = yo && yo.activo && (await claveCorrecta(clave, yo.hash));
  if (!entra) {
    return NextResponse.json({ ok: false, motivo: 'Correo o contraseña incorrectos.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await armarCookie(yo.id, secreto), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: DURACION,
  });
  return res;
}
