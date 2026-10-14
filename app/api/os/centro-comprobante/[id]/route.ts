import { NextResponse } from 'next/server';
import { hayPuerta, huella, igual } from '@/lib/os-sesion';
import { cookieDelOs } from '@/lib/os-sesion-servidor';
import { enlaceDelComprobante } from '@/lib/comprobantes-pago';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** El comprobante que subió un inquilino, para que lo abra el equipo. */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = await cookieDelOs();
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }
  const enlace = await enlaceDelComprobante(params.id);
  if (!enlace) return NextResponse.json({ error: 'Ese comprobante no existe.' }, { status: 404 });
  return NextResponse.redirect(enlace, 302);
}
