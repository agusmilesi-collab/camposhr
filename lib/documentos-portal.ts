/**
 * Los documentos del portal: propuestas, casos e informes escritos a mano.
 *
 * Viven en el bucket privado, en `portal-documentos/<cliente>/...`, y no en el
 * repositorio, que es público: son documentos de clientes e informes de
 * personas con nombre y apellido. Se suben con
 * `scripts/subir-documentos-portal.mjs` y salen solo por las dos rutas del
 * portal, después de comprobar el enlace.
 */

import 'server-only';

const BUCKET = 'psicotecnicos';

/** Las rutas salen de las listas fijas de `lib/servicios.ts`, nunca de la dirección. */
const RUTA_VALIDA = /^[a-z0-9-]+(\/[a-z0-9-]+)*\.html$/;

async function leer(rutaEnBucket: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url.replace(/\/$/, '')}/storage/v1/object/${BUCKET}/${rutaEnBucket}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' }
    );
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** El HTML de un documento, o null si no está. */
export async function leerDocumento(ruta: string): Promise<string | null> {
  return RUTA_VALIDA.test(ruta) ? leer(`portal-documentos/${ruta}`) : null;
}

const TOKEN_COTIZACION = /^[A-Za-z0-9_-]{6,128}$/;

/**
 * La propuesta que abre el cliente en camposhr.com/q/<token>.
 *
 * Está en `cotizaciones/<token>.html` del mismo bucket. Antes era un archivo de
 * `public/q/`, con el enlace secreto escrito en el nombre y a la vista en el
 * repositorio. Se sube con `scripts/publicar-cotizacion.mjs`.
 */
export async function leerCotizacion(token: string): Promise<string | null> {
  return TOKEN_COTIZACION.test(token) ? leer(`cotizaciones/${token}.html`) : null;
}
