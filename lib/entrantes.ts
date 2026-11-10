import 'server-only';
import { randomUUID } from 'node:crypto';
import { tipoPermitido } from '@/lib/archivos-permitidos';

/**
 * Los archivos que el cliente sube desde su portal, antes de que entren.
 *
 * **No pasan por Vercel.** Vercel rechaza todo pedido de más de 4,5 MB antes
 * de que llegue al código, con un 413 en texto plano, y ese límite cuenta el
 * formulario entero: todos los CV más el descriptivo. Así se perdieron un CV
 * de Crucijuegos (5/11/2026) y un pedido de Federada (10/11/2026). El servidor
 * firma una dirección de subida y el navegador manda el archivo directo al
 * bucket, a `entrantes/`.
 *
 * Al guardar el pedido, el servidor lo trae de ahí (`traerEntrante`) y lo sube
 * con el camino de siempre (`subirCv`, `subirDescriptivo`), que le pone el
 * tipo por la extensión y no por lo que declaró el navegador. Después lo borra.
 * Lo que queda en `entrantes/` es lo de un formulario que nunca se mandó.
 */

const BUCKET = 'psicotecnicos';

/** Hasta cuánto puede pesar cada archivo. */
export const MAX_ENTRANTE = 10 * 1024 * 1024;

/** Cómo es una ruta de las que firma este módulo; cualquier otra se ignora. */
const RUTA = /^entrantes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]{2,4}$/;

function config(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');
  return { url, key };
}

export type Firma =
  | { ok: true; ruta: string; url: string; tipo: string }
  | { ok: false; error: string };

/** La dirección a la que el navegador sube ese archivo, o por qué no se acepta. */
export async function firmarSubida(nombre: string, tamano: number): Promise<Firma> {
  const permitido = tipoPermitido(nombre);
  if (!permitido) return { ok: false, error: `${nombre} no es un tipo de archivo que se pueda subir.` };
  if (tamano > MAX_ENTRANTE) return { ok: false, error: `${nombre} supera los 10 MB.` };

  const { url, key } = config();
  const ruta = `entrantes/${randomUUID()}.${permitido.ext}`;
  const res = await fetch(`${url}/storage/v1/object/upload/sign/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`firma de subida: ${res.status} ${await res.text()}`);
  const { url: firmada } = (await res.json()) as { url: string };
  return { ok: true, ruta, url: `${url}/storage/v1${firmada}`, tipo: permitido.tipo };
}

/**
 * El archivo que el navegador subió, con el nombre que tenía. Null si la ruta
 * no es de las nuestras, si no está o si pesa de más.
 */
export async function traerEntrante(ruta: string, nombre: string): Promise<File | null> {
  if (!RUTA.test(ruta)) return null;
  const { url, key } = config();
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ENTRANTE) return null;
  return new File([bytes], nombre.slice(0, 160) || ruta.split('/').pop()!);
}

/** Borra lo que ya entró. No tira: lo que quede en `entrantes/` no molesta. */
export async function borrarEntrantes(rutas: string[]): Promise<void> {
  const validas = rutas.filter((r) => RUTA.test(r));
  if (validas.length === 0) return;
  try {
    const { url, key } = config();
    await fetch(`${url}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: validas }),
      cache: 'no-store',
    });
  } catch (e) {
    console.error('entrantes: no se pudieron borrar', e);
  }
}

/**
 * El CV de un formulario del OS: el que el navegador subió al bucket
 * (`cvRuta`), o el archivo suelto de un formulario abierto desde antes del
 * cambio. `perdido` si vino una ruta y el archivo no está: el alta no sigue
 * sin él, porque quien lo cargó cree que lo adjuntó.
 */
export async function cvDelFormulario(
  form: FormData
): Promise<{ cv: File | null; ruta: string | null; perdido: boolean }> {
  const ruta = (form.get('cvRuta') ?? '').toString().trim();
  if (ruta) {
    const cv = await traerEntrante(ruta, (form.get('cvNombre') ?? '').toString());
    return { cv, ruta, perdido: !cv };
  }
  const adjunto = form.get('cv');
  return {
    cv: adjunto instanceof File && adjunto.size > 0 ? adjunto : null,
    ruta: null,
    perdido: false,
  };
}
