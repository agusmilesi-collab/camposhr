import 'server-only';

/**
 * La firma manuscrita de quien firma el informe.
 *
 * Va en el bucket privado y no en `public/`: este repositorio es público y lo
 * que vive en `public/` se sirve a cualquiera que sepa la dirección. Una firma
 * suelta en una dirección fija es una firma que se puede bajar limpia y pegar
 * en cualquier otro papel.
 *
 * Del bucket sale una vez y se queda en memoria: son quince kilobytes que no
 * cambian, y pedirla en cada informe sería una llamada de red para dibujar lo
 * mismo. Entra al documento como `data:` y no como una dirección firmada porque
 * el informe se imprime a PDF y se guarda: una dirección que vence en una hora
 * dejaría el papel sin firma al día siguiente.
 */

const BUCKET = 'psicotecnicos';

/** Lo ya leído, por ruta. Se pierde al reiniciarse el servidor, que es lo que hay que hacer para cambiar una firma. */
const enMemoria = new Map<string, string | null>();

export async function firmaEnDatos(ruta: string): Promise<string | null> {
  if (enMemoria.has(ruta)) return enMemoria.get(ruta) ?? null;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  try {
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('firma: no se pudo leer', ruta, res.status);
      enMemoria.set(ruta, null);
      return null;
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    const datos = `data:image/png;base64,${bytes.toString('base64')}`;
    enMemoria.set(ruta, datos);
    return datos;
  } catch (e) {
    console.error('firma:', e);
    enMemoria.set(ruta, null);
    return null;
  }
}
