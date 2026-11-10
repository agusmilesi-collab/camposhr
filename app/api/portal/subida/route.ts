import { NextResponse } from 'next/server';
import { empresaDelToken } from '@/lib/portal-supabase';
import { esDemo } from '@/lib/portal-demo';
import { firmarSubida } from '@/lib/entrantes';
import { MAXIMO_CV } from '@/lib/cv-lectura';
import { registrarError } from '@/lib/portal-errores';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Las direcciones a las que el portal sube los CV y el descriptivo.
 *
 * Lo que viaja acá son el nombre y el peso de cada archivo, no el archivo: el
 * archivo va del navegador al bucket (`lib/entrantes.ts`), porque por Vercel no
 * pasa nada de más de 4,5 MB.
 */
export async function POST(req: Request) {
  const cuerpo = (await req.json().catch(() => null)) as {
    token?: string;
    archivos?: { nombre?: string; tamano?: number }[];
  } | null;
  const token = (cuerpo?.token ?? '').toString().trim();
  const empresa = esDemo(token) ? null : await empresaDelToken(token);
  if (!esDemo(token) && !empresa) {
    return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  }

  // Un CV por candidato más el descriptivo.
  const archivos = (cuerpo?.archivos ?? []).slice(0, MAXIMO_CV + 1);
  if (archivos.length === 0) {
    return NextResponse.json({ error: 'No llegó ningún archivo.' }, { status: 400 });
  }

  try {
    const firmas = await Promise.all(
      archivos.map((a) => firmarSubida(String(a.nombre ?? ''), Number(a.tamano) || 0))
    );
    return NextResponse.json({ firmas });
  } catch (e) {
    await registrarError({
      empresaId: empresa?.id ?? null,
      paso: 'subida',
      motivo: 'No se pudo firmar la dirección de subida.',
      detalle: { error: String(e), archivos },
    });
    return NextResponse.json(
      { error: 'No pudimos preparar la subida de los archivos. Probá de nuevo en un rato.' },
      { status: 502 }
    );
  }
}
