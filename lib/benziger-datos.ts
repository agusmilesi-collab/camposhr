/**
 * El Benziger de una evaluación: su informe en PDF y su cuadrante.
 *
 * El PDF es el informe que devuelve la licencia, y de ahí sale todo lo demás.
 * Se guarda en el bucket privado, nunca en una dirección pública: trae el
 * nombre de la persona y su perfil de pensamiento.
 *
 * El cuadrante lo elige la evaluadora leyendo ese informe. Queda en su propia
 * columna y no dentro del JSON del parseo, porque es una lectura de una
 * persona y el JSON es lo que devuelve la máquina.
 */

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
 * Sube el informe y devuelve su ruta.
 *
 * Se pisa el anterior a propósito: hay un solo informe Benziger por
 * evaluación, y dejar los dos obliga a decidir después cuál era el bueno.
 */
async function subirPdf(evaluacionId: string, pdf: File): Promise<string> {
  const { url, key } = config();
  const ruta = `benziger/${evaluacionId}.pdf`;
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': pdf.type || 'application/pdf',
      'x-upsert': 'true',
    },
    body: new Uint8Array(await pdf.arrayBuffer()),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`No se pudo subir el PDF: ${res.status} ${await res.text()}`);
  return ruta;
}

export type BenzigerCarga = {
  /** Los códigos de los cuadrantes preferentes: FI, FD, BI, BD. */
  cuadrantes: string[];
  pdf?: File | null;
  /** Lo que se leyó del informe, si se pudo leer. */
  leido?: {
    cuadrantes: Record<string, unknown>;
    adjetivos: Record<string, unknown>;
    abiertas: Record<string, unknown>;
    estres: Record<string, unknown>;
  } | null;
};

export async function guardarBenziger(
  evaluacionId: string,
  c: BenzigerCarga
): Promise<{ ok: true; conPdf: boolean } | { ok: false; motivo: string }> {
  if (!UUID.test(evaluacionId)) return { ok: false, motivo: 'Evaluación inválida.' };

  const fila: Record<string, unknown> = {
    evaluacion_id: evaluacionId,
    cuadrante_preferente: c.cuadrantes,
    actualizado_at: new Date().toISOString(),
  };
  if (c.pdf) {
    fila.pdf_path = await subirPdf(evaluacionId, c.pdf);
    // El archivo se guarda con el identificador de la evaluación, que sirve
    // para encontrarlo y no para reconocerlo: el nombre original es lo que
    // deja ver si el que está cargado es el que corresponde.
    fila.pdf_nombre = c.pdf.name;
  }
  if (c.leido) {
    fila.cuadrantes = c.leido.cuadrantes;
    fila.adjetivos = c.leido.adjetivos;
    fila.abiertas = c.leido.abiertas;
    fila.estres = c.leido.estres;
  }

  const { url, key } = config();
  const res = await fetch(`${url}/rest/v1/benziger`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      // La fila es una por evaluación: si ya está, se actualiza.
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(fila),
    cache: 'no-store',
  });
  if (!res.ok) {
    return { ok: false, motivo: `Supabase respondió ${res.status}: ${await res.text()}` };
  }
  return { ok: true, conPdf: Boolean(c.pdf) };
}

/**
 * Una dirección firmada y de vida corta para abrir el informe.
 *
 * El bucket es privado. Sin esto el PDF no se puede mirar, y un informe que no
 * se puede abrir no sirve para revisar si se subió el que era.
 */
export async function enlaceDelInforme(evaluacionId: string): Promise<string | null> {
  if (!UUID.test(evaluacionId)) return null;

  const filas = await select<{ pdf_path: string | null }>(
    'benziger',
    `select=pdf_path&evaluacion_id=eq.${evaluacionId}&limit=1`
  );
  const ruta = filas[0]?.pdf_path;
  if (!ruta) return null;

  const { url, key } = config();
  const res = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    // Cinco minutos: lo que tarda en abrirse, no lo que tarda en circular.
    body: JSON.stringify({ expiresIn: 300 }),
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('benziger: no se pudo firmar el enlace', res.status, await res.text());
    return null;
  }
  const r = (await res.json()) as { signedURL?: string };
  return r.signedURL ? `${url}/storage/v1${r.signedURL}` : null;
}
