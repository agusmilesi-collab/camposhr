import 'server-only';
import { patch, select } from '@/lib/supabase';

/**
 * El descriptivo de puesto de un pedido.
 *
 * Es el documento que el cliente ya tiene escrito sobre el puesto y adjunta
 * desde su portal, al cargar el pedido o al sumarle candidatos. Es opcional.
 *
 * Va al bucket privado y se sirve con una dirección firmada: es un documento
 * interno de la empresa del cliente. Uno por pedido: subir otro reemplaza al
 * anterior, que es lo que se quiere cuando el cliente manda la versión
 * corregida.
 */

const BUCKET = 'psicotecnicos';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Hasta cuánto puede pesar. */
export const MAX_DESCRIPTIVO = 10 * 1024 * 1024;

function config(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');
  return { url, key };
}

/**
 * Guarda el archivo y lo anota en el pedido.
 *
 * Si falla, no tira: el pedido y sus candidatos ya entraron, y perder el
 * adjunto no puede costar el pedido entero. Devuelve si quedó guardado.
 */
export async function subirDescriptivo(pedidoId: string, archivo: File): Promise<boolean> {
  try {
    const { url, key } = config();
    const ext = (archivo.name.includes('.') ? (archivo.name.split('.').pop() ?? '') : '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 8);
    const ruta = `descriptivos/${pedidoId}${ext ? `.${ext}` : ''}`;
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': archivo.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: new Uint8Array(await archivo.arrayBuffer()),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('descriptivo: no se pudo subir', res.status, await res.text());
      return false;
    }
    await patch('pedidos', `id=eq.${pedidoId}`, {
      descriptivo_path: ruta,
      descriptivo_nombre: archivo.name.slice(0, 160),
    });
    return true;
  } catch (e) {
    console.error('descriptivo: no se pudo subir', e);
    return false;
  }
}

/**
 * La dirección firmada para abrirlo, o null si el pedido no tiene.
 *
 * Se baja con el nombre que tenía cuando lo subieron: en el bucket se llama
 * como el pedido, que a quien lo abre no le dice nada.
 */
export async function enlaceDelDescriptivo(pedidoId: string): Promise<string | null> {
  if (!UUID.test(pedidoId)) return null;
  const fila = (
    await select<{ descriptivo_path: string | null; descriptivo_nombre: string | null }>(
      'pedidos',
      `select=descriptivo_path,descriptivo_nombre&id=eq.${pedidoId}&limit=1`,
    ).catch(() => [])
  )[0];
  if (!fila?.descriptivo_path) return null;

  const { url, key } = config();
  const res = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${fila.descriptivo_path}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    // Cinco minutos: lo que tarda en abrirse, no lo que tarda en circular.
    body: JSON.stringify({ expiresIn: 300 }),
    cache: 'no-store',
  }).catch(() => null);
  if (!res?.ok) return null;

  const { signedURL } = (await res.json()) as { signedURL: string };
  const nombre = fila.descriptivo_nombre
    ? `&download=${encodeURIComponent(fila.descriptivo_nombre)}`
    : '';
  return `${url}/storage/v1${signedURL}${nombre}`;
}
