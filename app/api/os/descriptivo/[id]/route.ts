import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { enlaceDelDescriptivo } from '@/lib/descriptivo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Abre el descriptivo de puesto de un pedido.
 *
 * El enlace se firma en el momento del clic y no al dibujar la ficha: firmado
 * al dibujar vence a los cinco minutos, y la ficha del pedido queda abierta
 * mucho más que eso.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }
  const enlace = await enlaceDelDescriptivo(params.id);
  if (!enlace) return NextResponse.json({ error: 'Sin descriptivo.' }, { status: 404 });
  return NextResponse.redirect(enlace);
}
