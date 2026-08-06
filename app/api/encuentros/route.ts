import { NextResponse } from 'next/server';
import { crearEncuentro } from '@/lib/ciclo';
import crypto from 'node:crypto';

/**
 * Alta de un encuentro: un cliente que va a recorrer un ciclo.
 *
 * Vive en el hub interno, junto a Presentaciones, y no en el control de la
 * expositora: el control es la pantalla que se tiene abierta con treinta
 * personas mirando, y crear clientes desde ahí es pedir un accidente en vivo.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let datos: { empresa?: unknown; cicloId?: unknown };
  try {
    datos = await req.json();
  } catch {
    return new NextResponse('Datos ilegibles', { status: 400 });
  }

  // La clave se genera del lado del servidor: la única barrera entre el control
  // y los asistentes no puede quedar librada a lo que alguien escriba apurado.
  const clave = crypto.randomBytes(12).toString('hex');

  try {
    const alta = await crearEncuentro(
      String(datos.empresa ?? ''),
      String(datos.cicloId ?? ''),
      clave
    );
    return NextResponse.json({ ok: true, ...alta });
  } catch (e) {
    const msg = (e as Error).message;
    return new NextResponse(msg.length < 90 ? msg : 'No se pudo dar de alta', {
      status: 400,
    });
  }
}
