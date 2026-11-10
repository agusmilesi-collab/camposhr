import { NextResponse } from 'next/server';
import { empresaDelToken } from '@/lib/portal-supabase';
import { esDemo } from '@/lib/portal-demo';
import { esPaso, registrarError } from '@/lib/portal-errores';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lo que falló del lado del navegador al cargar un pedido: un archivo que no
 * subió al bucket, una respuesta que no se pudo leer, la conexión que se cortó.
 * Esas fallas el servidor no las ve, así que las avisa el formulario.
 */
export async function POST(req: Request) {
  const cuerpo = (await req.json().catch(() => null)) as {
    token?: string;
    paso?: string;
    motivo?: string;
    detalle?: Record<string, unknown>;
  } | null;
  const token = (cuerpo?.token ?? '').toString().trim();
  const empresa = esDemo(token) ? null : await empresaDelToken(token);
  if (!esDemo(token) && !empresa) {
    return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  }
  if (!esPaso(cuerpo?.paso) || !cuerpo?.motivo) {
    return NextResponse.json({ error: 'Falta qué falló.' }, { status: 400 });
  }

  await registrarError({
    empresaId: empresa?.id ?? null,
    paso: cuerpo.paso,
    motivo: String(cuerpo.motivo),
    detalle: {
      ...(cuerpo.detalle && typeof cuerpo.detalle === 'object' ? cuerpo.detalle : {}),
      ...(esDemo(token) ? { prueba: true } : {}),
      navegador: req.headers.get('user-agent') ?? '',
    },
  });
  return NextResponse.json({ ok: true });
}
