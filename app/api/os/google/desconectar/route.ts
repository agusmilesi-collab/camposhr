import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { desconectar } from '@/lib/google-calendario';
import { anotarAcceso } from '@/lib/accesos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Corta la conexión con el calendario de una evaluadora.
 *
 * Recibe un formulario y vuelve a la pestaña: el botón es un `submit` y no
 * hace falta un componente de cliente para apretarlo.
 */
export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
    }
  }

  const origen = new URL(req.url).origin;
  const form = await req.formData().catch(() => null);
  const evaluadora = (form?.get('evaluadora') ?? '').toString();
  let como = 'fallo';
  if (UUID.test(evaluadora)) {
    try {
      await desconectar(evaluadora);
      await anotarAcceso({
        accion: 'escritura',
        recurso: 'google_calendario',
        detalle: { evaluadora, conexion: 'cortada' },
      });
      como = 'cortado';
    } catch (e) {
      console.error('google desconectar:', e);
    }
  }
  return NextResponse.redirect(`${origen}/os/configuracion?ver=calendario&google=${como}`, 303);
}
