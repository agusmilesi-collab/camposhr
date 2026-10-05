import { NextResponse } from 'next/server';
import { laminaDelToken } from '@/lib/laminas-enlace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * En qué lámina tiene que estar la pantalla de la persona evaluada.
 *
 * La consulta su pantalla cada segundo y medio. Devuelve null mientras la
 * evaluadora no haya pasado de lámina desde que se generó el enlace, y ahí la
 * pantalla se queda donde está.
 */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const estado = await laminaDelToken(params.token);
  if (!estado) return NextResponse.json({ vencido: true }, { status: 401 });
  return NextResponse.json(
    { lamina: estado.lamina },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
