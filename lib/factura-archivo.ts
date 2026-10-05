/**
 * El PDF de una factura autorizada, guardado.
 *
 * Cuando ARCA autoriza un comprobante se genera su PDF, con los tres
 * ejemplares, y se guarda en el bucket privado. Es el archivo que se le manda
 * al cliente y el que se vuelve a bajar después: una factura emitida tiene que
 * verse siempre igual, aunque mañana cambie el diseño de la hoja o un dato del
 * cliente.
 *
 * Va al bucket privado y no al repositorio ni a `public/`: una factura trae el
 * CUIT y el domicilio de quien emite y de quien recibe.
 *
 * Las que no tienen CAE no se guardan: no son comprobantes, y su PDF se arma en
 * el momento cada vez que se pide.
 */

import 'server-only';
import { patch, select } from '@/lib/supabase';
import { datosDeFactura } from '@/lib/factura-datos';
import { archivoDeFactura, pdfDeFactura } from '@/lib/factura-pdf';

const BUCKET = 'psicotecnicos';

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');
  return { url, key };
}

/**
 * Genera el PDF de una factura con CAE y lo guarda. Devuelve la ruta, o null si
 * no se pudo: la factura ya está emitida, y no poder guardar su archivo no
 * puede hacer que la emisión figure como fallida.
 */
export async function guardarPdfDeFactura(id: string): Promise<string | null> {
  try {
    const d = await datosDeFactura(id);
    if (!d || !d.conCae) return null;
    const bytes = await pdfDeFactura(d);
    const { url, key } = config();
    // Por ambiente, emisora y tipo: una de homologación y una real pueden
    // tener el mismo punto de venta y el mismo número.
    const ruta =
      `facturas/${d.dePrueba ? 'homologacion' : 'produccion'}/${d.emisor.cuitCrudo ?? 'sin-cuit'}/` +
      `${d.codigo}-${d.numeroLargo}.pdf`;
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true',
      },
      body: Buffer.from(bytes),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('factura: no se pudo guardar el PDF', res.status, await res.text());
      return null;
    }
    await patch('facturas', `id=eq.${id}`, { pdf_path: ruta });
    return ruta;
  } catch (e) {
    console.error('factura: no se pudo guardar el PDF', e);
    return null;
  }
}

/**
 * El PDF de una factura para bajar: el guardado si existe, y si no, uno armado
 * en el momento.
 */
export async function pdfParaBajar(id: string): Promise<{ bytes: Uint8Array; nombre: string } | null> {
  const d = await datosDeFactura(id);
  if (!d) return null;
  const nombre = archivoDeFactura(d);
  const [fila] = await select<{ pdf_path: string | null }>('facturas', `select=pdf_path&id=eq.${id}&limit=1`);
  if (fila?.pdf_path) {
    const { url, key } = config();
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${fila.pdf_path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (res.ok) return { bytes: new Uint8Array(await res.arrayBuffer()), nombre };
    console.error('factura: el PDF guardado no se pudo leer', res.status);
  }
  return { bytes: await pdfDeFactura(d), nombre };
}
