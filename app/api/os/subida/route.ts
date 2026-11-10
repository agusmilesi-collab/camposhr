import { NextResponse } from 'next/server';
import { hayPuerta, huella, igual } from '@/lib/os-sesion';
import { cookieDelOs } from '@/lib/os-sesion-servidor';
import { firmarSubida } from '@/lib/entrantes';
import { MAXIMO_CV } from '@/lib/cv-lectura';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Las direcciones a las que el OS sube los CV: la misma subida directa al
 * bucket que usa el portal (`lib/entrantes.ts`), con la sesión del OS en vez
 * del token del cliente. Por Vercel no pasa nada de más de 4,5 MB.
 */
export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = await cookieDelOs();
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }

  const cuerpo = (await req.json().catch(() => null)) as {
    archivos?: { nombre?: string; tamano?: number }[];
  } | null;
  const archivos = (cuerpo?.archivos ?? []).slice(0, MAXIMO_CV);
  if (archivos.length === 0) {
    return NextResponse.json({ error: 'No llegó ningún archivo.' }, { status: 400 });
  }

  try {
    const firmas = await Promise.all(
      archivos.map((a) => firmarSubida(String(a.nombre ?? ''), Number(a.tamano) || 0))
    );
    return NextResponse.json({ firmas });
  } catch (e) {
    console.error('subida del OS:', e);
    return NextResponse.json({ error: 'No se pudo preparar la subida del archivo.' }, { status: 502 });
  }
}
