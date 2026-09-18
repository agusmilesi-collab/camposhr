import { NextResponse } from 'next/server';
import { guardarGuion } from '@/lib/guion';
import { charlaPorToken } from '@/lib/presentaciones';

/**
 * El guion del expositor de una presentación.
 *
 * Solo escribe: la pantalla lo recibe ya servido por el servidor, así que no
 * hace falta pedirlo por acá.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: { token: string } }) {
  if (!charlaPorToken(params.token)) {
    return new NextResponse('No existe', { status: 404 });
  }

  let datos: { texto?: unknown };
  try {
    datos = await req.json();
  } catch {
    return new NextResponse('Datos ilegibles', { status: 400 });
  }

  // Un guion largo son unas pocas decenas de miles de caracteres; el tope está
  // para que un pegado accidental no entre entero a la base.
  const texto = String(datos.texto ?? '').slice(0, 200000);

  try {
    await guardarGuion(params.token, texto);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = (e as Error).message;
    return new NextResponse(msg.length < 120 ? msg : 'No se pudo guardar', { status: 500 });
  }
}
