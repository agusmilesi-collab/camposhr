import { NextResponse } from 'next/server';
import { COOKIE, DURACION, huella, igual } from '@/lib/os-sesion';

export const runtime = 'nodejs';

/**
 * Entrada al OS. Recibe la clave, deja la sesión y vuelve a donde se iba.
 *
 * La respuesta no distingue entre "no hay clave configurada" y "la clave está
 * mal": las dos dan lo mismo del lado de afuera.
 */
export async function POST(req: Request) {
  const datos = await req.formData();
  const clave = String(datos.get('clave') ?? '');
  const destino = String(datos.get('destino') ?? '/os');
  const esperada = process.env.OS_CLAVE;

  const ok = Boolean(esperada) && clave.length > 0 && clave === esperada;
  if (!ok) {
    return NextResponse.redirect(
      new URL(`/os/entrar?error=1&destino=${encodeURIComponent(destino)}`, req.url),
      303
    );
  }

  // El destino se limita a rutas del propio OS: sin esto, un enlace armado
  // desde afuera podría usar esta puerta para redirigir a otro sitio.
  const limpio = destino.startsWith('/os') ? destino : '/os';
  const res = NextResponse.redirect(new URL(limpio, req.url), 303);
  res.cookies.set(COOKIE, await huella(esperada as string), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: DURACION,
  });
  return res;
}
