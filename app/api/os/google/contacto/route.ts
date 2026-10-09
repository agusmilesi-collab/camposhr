import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { agendarContacto } from '@/lib/google-contactos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Agenda al candidato en los contactos de Google de su evaluadora.
 *
 * Lo llama la tarjeta de Por citar cuando se toca el WhatsApp, por detrás: la
 * conversación se abre igual, salga esto bien o mal.
 */
export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
    }
  }
  const datos = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof datos?.id === 'string' ? datos.id : '';
  return NextResponse.json({ ok: true, contacto: await agendarContacto(id) });
}
