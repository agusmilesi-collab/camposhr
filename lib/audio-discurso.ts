import 'server-only';
import { select } from '@/lib/supabase';

/**
 * La grabación de los cinco minutos de discurso libre.
 *
 * Es el material del que sale el estrato de la persona: se pide al final de la
 * entrevista, se guarda acá y se escucha al codificar, en la pestaña Potencial.
 *
 * Va al bucket privado y nunca a una dirección pública. Es la voz de una
 * persona identificable hablando de lo que le interesa, así que se sirve
 * siempre con un enlace firmado que caduca.
 */

const BUCKET = 'psicotecnicos';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Los formatos que se aceptan.
 *
 * Son los que cualquier navegador puede reproducir, que es lo único que hace
 * falta: la evaluadora escucha, no edita. Los cuatro primeros ya vienen
 * comprimidos y un teléfono devuelve dos o tres megas por cinco minutos; el
 * `wav` entra porque hay grabadoras que solo dan eso, y se achica antes de
 * subirlo.
 */
export const FORMATOS: Record<string, string> = {
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  webm: 'audio/webm',
  wav: 'audio/wav',
};

/** Veinticinco megas: cinco minutos comprimidos pesan dos o tres. */
export const MAX_AUDIO = 25 * 1024 * 1024;

function config(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');
  return { url, key };
}

/** La extensión con la que se guarda, sacada del nombre y del tipo. */
export function extensionDeAudio(archivo: File): string | null {
  const delNombre = archivo.name.includes('.') ? archivo.name.split('.').pop()!.toLowerCase() : '';
  if (FORMATOS[delNombre]) return delNombre;
  const porTipo = Object.entries(FORMATOS).find(([, tipo]) => tipo === archivo.type);
  return porTipo ? porTipo[0] : null;
}

/**
 * Guarda la grabación y la deja anotada en el análisis.
 *
 * Una evaluación tiene una sola: se pisa la anterior, que es lo que pasa cuando
 * se sube la que no era. Por eso la ruta lleva el id de la evaluación y no un
 * nombre al azar.
 */
export async function guardarAudio(
  evaluacionId: string,
  archivo: File,
  quien: string
): Promise<{ ok: true; nombre: string } | { ok: false; motivo: string }> {
  if (!UUID.test(evaluacionId)) return { ok: false, motivo: 'Evaluación inválida.' };
  const ext = extensionDeAudio(archivo);
  if (!ext) {
    return {
      ok: false,
      motivo: 'Ese formato no se puede reproducir. Sirven m4a, mp3, aac, ogg, opus, webm y wav.',
    };
  }
  if (archivo.size > MAX_AUDIO) {
    return { ok: false, motivo: 'La grabación supera los 25 MB.' };
  }

  const { url, key } = config();
  const ruta = `discurso/${evaluacionId}.${ext}`;
  const subida = await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': FORMATOS[ext],
      'x-upsert': 'true',
    },
    body: new Uint8Array(await archivo.arrayBuffer()),
    cache: 'no-store',
  });
  if (!subida.ok) {
    throw new Error(`No se pudo subir la grabación: ${subida.status} ${await subida.text()}`);
  }

  /* El análisis puede no existir todavía: la grabación se sube el mismo día de
     la entrevista, antes de que nadie codifique nada. Por eso es un upsert. */
  const res = await fetch(`${url}/rest/v1/analisis_discursivo`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      evaluacion_id: evaluacionId,
      quien,
      actualizado_at: new Date().toISOString(),
      audio_path: ruta,
      audio_nombre: archivo.name.slice(0, 200),
      audio_bytes: archivo.size,
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);

  return { ok: true, nombre: archivo.name };
}

/** Saca la grabación: el archivo y lo anotado. */
export async function borrarAudio(evaluacionId: string): Promise<boolean> {
  if (!UUID.test(evaluacionId)) return false;
  const { url, key } = config();

  const filas = await select<{ audio_path: string | null }>(
    'analisis_discursivo',
    `select=audio_path&evaluacion_id=eq.${evaluacionId}&limit=1`
  );
  const ruta = filas[0]?.audio_path;
  if (ruta) {
    await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    }).catch(() => null);
  }

  const res = await fetch(
    `${url}/rest/v1/analisis_discursivo?evaluacion_id=eq.${evaluacionId}`,
    {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ audio_path: null, audio_nombre: null, audio_bytes: null }),
      cache: 'no-store',
    }
  );
  return res.ok;
}

/**
 * El enlace para escucharla, firmado y con vencimiento.
 *
 * Dura una hora: la evaluadora abre la ficha, escucha, vuelve a escuchar un
 * tramo y elige el modo, y con cinco minutos el reproductor se le apagaba en el
 * medio.
 */
export async function enlaceDelAudio(evaluacionId: string): Promise<string | null> {
  if (!UUID.test(evaluacionId)) return null;

  const filas = await select<{ audio_path: string | null }>(
    'analisis_discursivo',
    `select=audio_path&evaluacion_id=eq.${evaluacionId}&limit=1`
  );
  const ruta = filas[0]?.audio_path;
  if (!ruta) return null;

  const { url, key } = config();
  const res = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 3600 }),
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('discurso: no se pudo firmar el enlace', res.status, await res.text());
    return null;
  }
  const { signedURL } = (await res.json()) as { signedURL: string };
  return `${url}/storage/v1${signedURL}`;
}
