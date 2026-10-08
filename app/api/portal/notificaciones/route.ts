import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { empresaDelToken } from '@/lib/portal-supabase';
import { patch, select } from '@/lib/supabase';
import { CACHE_CLIENTES } from '@/lib/etiquetas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Qué avisos quiere recibir por correo una persona del cliente.
 *
 * Lo tilda ella misma en el portal, al elegir su nombre para enviar un pedido,
 * y se guarda en su contacto: son las mismas marcas que el equipo ve y cambia
 * en la ficha del cliente.
 *
 * El token del portal es la credencial, y solo alcanza a los contactos de esa
 * empresa: el filtro por empresa va en la escritura, no solo en la pantalla.
 * De acá no se toca nada más: ni si solicita, ni si es de compras, ni su correo.
 */
export async function POST(req: Request) {
  const datos = await req.json().catch(() => null);
  const token = String(datos?.token ?? '').trim();
  const contactoId = String(datos?.contactoId ?? '').trim();
  const empresa = token ? await empresaDelToken(token) : null;
  if (!empresa || !UUID.test(contactoId)) {
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 404 });
  }

  const cambios: Record<string, boolean> = {};
  if (typeof datos.recibeOrden === 'boolean') cambios.recibe_orden = datos.recibeOrden;
  if (typeof datos.recibeEntrevista === 'boolean') cambios.recibe_entrevista = datos.recibeEntrevista;
  if (typeof datos.recibeInforme === 'boolean') cambios.recibe_informe = datos.recibeInforme;
  if (typeof datos.recibeFactura === 'boolean') cambios.recibe_factura = datos.recibeFactura;
  if (typeof datos.recibeRecibo === 'boolean') cambios.recibe_recibo = datos.recibeRecibo;
  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: 'No hay nada que guardar.' }, { status: 400 });
  }

  const filtro = `id=eq.${contactoId}&empresa_id=eq.${empresa.id}&activo=is.true`;
  try {
    const [suyo] = await select<{ id: string }>('contactos', `select=id&${filtro}&limit=1`);
    if (!suyo) return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 404 });
    await patch('contactos', filtro, cambios);
  } catch (e) {
    console.error('[notificaciones del portal]', e);
    return NextResponse.json({ error: 'No se pudo guardar. Probá de nuevo.' }, { status: 502 });
  }
  revalidateTag(CACHE_CLIENTES);
  return NextResponse.json({ ok: true });
}
