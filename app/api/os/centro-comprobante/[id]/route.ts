import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { enlaceDelComprobante } from '@/lib/comprobantes-pago';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** El comprobante que subió un inquilino, para que lo abra el equipo. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }
  const enlace = await enlaceDelComprobante(params.id);
  if (!enlace) return NextResponse.json({ error: 'Ese comprobante no existe.' }, { status: 404 });
  return NextResponse.redirect(enlace, 302);
}
