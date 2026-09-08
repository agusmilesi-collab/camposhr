import { NextResponse } from 'next/server';
import { guardarClave, NORMAS_VERSION } from '@/lib/centro-acceso';
import { armarCookie, COOKIE, DURACION } from '@/lib/centro-cookie';
import { patch, select } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * Poner la contraseña con el enlace de un solo uso.
 *
 * El mismo camino sirve para el alta y para restablecerla: las propietarias
 * generan el enlace desde el OS y lo mandan por WhatsApp, porque camposhr.com no
 * tiene correo saliente.
 *
 * **El enlace se quema al usarse** y vence a las 48 horas. Uno que quedara
 * vivo en un chat sería una llave permanente a la cuenta de esa persona.
 *
 * Acá también queda registrada la aceptación de las normas de convivencia, con
 * su versión y la fecha: reemplaza la firma en papel.
 */
export async function POST(req: Request) {
  const secreto = process.env.CENTRO_SECRETO;
  if (!secreto) {
    return NextResponse.json({ ok: false, motivo: 'El acceso todavía no está configurado.' }, { status: 503 });
  }

  const datos = await req.json().catch(() => null);
  const token = String(datos?.token ?? '');
  const clave = String(datos?.clave ?? '');
  const acepta = Boolean(datos?.acepta);
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(token)) {
    return NextResponse.json({ ok: false, motivo: 'El enlace no es válido.' }, { status: 400 });
  }
  if (clave.length < 8) {
    return NextResponse.json(
      { ok: false, motivo: 'La contraseña tiene que tener al menos 8 caracteres.' },
      { status: 400 }
    );
  }
  if (!acepta) {
    return NextResponse.json(
      { ok: false, motivo: 'Hay que aceptar las normas de convivencia para entrar.' },
      { status: 400 }
    );
  }

  const filas = await select<{ id: string; alta_vence: string | null; activo: boolean }>(
    'inquilinos',
    `select=id,alta_vence,activo&alta_token=eq.${encodeURIComponent(token)}`
  );
  const yo = filas[0];
  const vigente = yo && yo.activo && yo.alta_vence && new Date(yo.alta_vence) > new Date();
  if (!vigente) {
    return NextResponse.json(
      { ok: false, motivo: 'El enlace venció o ya se usó. Pedí uno nuevo.' },
      { status: 400 }
    );
  }

  await patch('inquilinos', `id=eq.${yo.id}`, {
    hash: await guardarClave(clave),
    alta_token: null,
    alta_vence: null,
    normas_version: NORMAS_VERSION,
    normas_aceptadas_at: new Date().toISOString(),
  });

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
