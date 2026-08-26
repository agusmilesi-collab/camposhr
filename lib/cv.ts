import 'server-only';
import { select } from '@/lib/supabase';

const BUCKET = 'psicotecnicos';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function config(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');
  return { url, key };
}

/**
 * El CV de la persona de una evaluación, por enlace firmado.
 *
 * Lo carga quien da de alta al candidato y lo mira la evaluadora antes de la
 * entrevista: es lo primero que se lee para saber con quién se va a hablar.
 * Vive en un bucket privado, así que se sirve firmado y no por dirección fija.
 *
 * Null cuando la persona no tiene CV cargado o cuando el archivo no se pudo
 * firmar: en los dos casos la pantalla dice que no hay, que es lo cierto para
 * quien lo busca.
 */
export async function enlaceDelCv(evaluacionId: string): Promise<string | null> {
  if (!UUID.test(evaluacionId)) return null;

  const filas = await select<{ personas: { cv_path: string | null } | null }>(
    'evaluaciones',
    `select=personas(cv_path)&id=eq.${evaluacionId}&limit=1`
  ).catch(() => []);
  const ruta = filas[0]?.personas?.cv_path;
  if (!ruta) return null;

  const { url, key } = config();
  const res = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    // Cinco minutos: lo que tarda en abrirse, no lo que tarda en circular.
    body: JSON.stringify({ expiresIn: 300 }),
    cache: 'no-store',
  }).catch(() => null);
  if (!res?.ok) return null;

  const { signedURL } = (await res.json()) as { signedURL: string };
  return `${url}/storage/v1${signedURL}`;
}
