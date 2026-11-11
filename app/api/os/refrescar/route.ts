import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { CACHE_CLIENTES, CACHE_COMERCIAL, CACHE_PSICOTECNICOS } from '@/lib/etiquetas';

/**
 * Renueva en el momento la copia de datos que guardan las pantallas del OS.
 *
 * Las pantallas guardan lo que leen de Supabase por cinco minutos y lo
 * renuevan cuando la escritura pasa por el propio OS. Un dato cargado directo
 * en la base (por ejemplo, las órdenes de compra que se cargan desde la
 * terminal) no avisaba, y la pantalla lo mostraba recién al vencer la copia
 * (Agustín, 11/11/2026). Quien escribe así llama a esta ruta al terminar.
 *
 * Pide la clave de servicio de Supabase en `x-clave`: la tiene solo quien ya
 * puede escribir en la base, así que no abre nada nuevo.
 */
export async function POST(req: Request) {
  const clave = process.env.SUPABASE_SERVICE_KEY;
  if (!clave || req.headers.get('x-clave') !== clave) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  for (const etiqueta of [CACHE_COMERCIAL, CACHE_PSICOTECNICOS, CACHE_CLIENTES]) {
    revalidateTag(etiqueta, { expire: 0 });
  }
  return NextResponse.json({ ok: true });
}
