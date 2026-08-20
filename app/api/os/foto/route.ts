import { NextResponse } from 'next/server';
import { fotoDe } from '@/lib/identidad';

export const runtime = 'nodejs';

/**
 * La foto de un miembro del equipo, para la barra de arriba.
 *
 * Va por una ruta y no como propiedad de la pantalla porque la barra la arma un
 * componente de cliente que usan las once pantallas del OS: pasarla por todas
 * sería tocar once archivos por un avatar.
 *
 * Devuelve `{ url: null }` cuando la foto no está subida, y ahí el avatar cae
 * en las iniciales.
 */
export async function GET(req: Request) {
  const nombre = new URL(req.url).searchParams.get('nombre') ?? '';
  if (!nombre) return NextResponse.json({ url: null });
  return NextResponse.json({ url: await fotoDe(nombre) });
}
