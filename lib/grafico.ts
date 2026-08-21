import 'server-only';
import { select } from '@/lib/supabase';
import { siEstaTodoTomado } from '@/lib/entrevista-completa';

/**
 * El dibujo de dos personas, guardado.
 *
 * Va al bucket privado y nunca a una dirección pública: es material clínico de
 * una persona identificable, y el archivo trae su trazo, que es el dato.
 *
 * Subirlo marca el test como administrado. Son la misma cosa dicha dos veces:
 * si está el dibujo, se tomó. Dejar que se separen abre el caso de un gráfico
 * cargado que el informe no puede usar porque nadie tildó la casilla.
 */

const BUCKET = 'psicotecnicos';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function config(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');
  return { url, key };
}

/** La extensión que corresponde, para que el navegador sepa qué está abriendo. */
function extension(archivo: File): string {
  const delNombre = archivo.name.includes('.') ? archivo.name.split('.').pop()!.toLowerCase() : '';
  if (/^[a-z0-9]{2,5}$/.test(delNombre)) return delNombre;
  return archivo.type === 'application/pdf' ? 'pdf' : 'jpg';
}

export async function guardarGrafico(
  evaluacionId: string,
  archivo: File
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!UUID.test(evaluacionId)) return { ok: false, motivo: 'Evaluación inválida.' };

  const { url, key } = config();
  // Se pisa el anterior: hay un dibujo por evaluación, y guardar los dos
  // obliga a decidir después cuál era el bueno.
  const ruta = `grafico/${evaluacionId}.${extension(archivo)}`;
  const subida = await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
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
  if (!subida.ok) {
    throw new Error(`No se pudo subir el dibujo: ${subida.status} ${await subida.text()}`);
  }

  const res = await fetch(`${url}/rest/v1/evaluaciones?id=eq.${evaluacionId}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      grafico_2_personas_path: ruta,
      grafico_2_personas_nombre: archivo.name,
      grafico_2_personas_administrado: true,
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);

  // Si con esto quedó tomado todo lo de su batería, la evaluación avanza sola.
  await siEstaTodoTomado(evaluacionId);
  return { ok: true };
}

/** El enlace para mirarlo, firmado y corto. */
export async function enlaceDelGrafico(evaluacionId: string): Promise<string | null> {
  if (!UUID.test(evaluacionId)) return null;

  const filas = await select<{ grafico_2_personas_path: string | null }>(
    'evaluaciones',
    `select=grafico_2_personas_path&id=eq.${evaluacionId}&limit=1`
  );
  const ruta = filas[0]?.grafico_2_personas_path;
  if (!ruta) return null;

  const { url, key } = config();
  const res = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    // Cinco minutos: lo que tarda en abrirse, no lo que tarda en circular.
    body: JSON.stringify({ expiresIn: 300 }),
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('grafico: no se pudo firmar el enlace', res.status, await res.text());
    return null;
  }
  const { signedURL } = (await res.json()) as { signedURL: string };
  return `${url}/storage/v1${signedURL}`;
}

/**
 * La hoja del Bender: las nueve láminas dibujadas, en una imagen.
 *
 * Llega ya armada y comprimida desde el navegador de la evaluadora, que es
 * donde están las nueve fotos originales. Acá solo se guarda.
 *
 * Igual que el gráfico, subirla marca el test como administrado: si están los
 * dibujos, se tomó.
 */
export async function guardarBender(
  evaluacionId: string,
  archivo: File,
  cuantas: number
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!UUID.test(evaluacionId)) return { ok: false, motivo: 'Evaluación inválida.' };

  const { url, key } = config();
  const ruta = `bender/${evaluacionId}.jpg`;
  const subida = await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: new Uint8Array(await archivo.arrayBuffer()),
    cache: 'no-store',
  });
  if (!subida.ok) {
    throw new Error(`No se pudo subir la hoja: ${subida.status} ${await subida.text()}`);
  }

  const res = await fetch(`${url}/rest/v1/evaluaciones?id=eq.${evaluacionId}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      bender_path: ruta,
      // Cuántas se unieron: con menos de nueve, la hoja está incompleta y hay
      // que poder verlo sin abrir la imagen.
      bender_nombre: `${cuantas} de 9 láminas`,
      bender_administrado: true,
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);

  // Si con esto quedó tomado todo lo de su batería, la evaluación avanza sola.
  await siEstaTodoTomado(evaluacionId);
  return { ok: true };
}

/** El enlace para mirar la hoja del Bender, firmado y corto. */
export async function enlaceDelBender(evaluacionId: string): Promise<string | null> {
  if (!UUID.test(evaluacionId)) return null;

  const filas = await select<{ bender_path: string | null }>(
    'evaluaciones',
    `select=bender_path&id=eq.${evaluacionId}&limit=1`
  );
  const ruta = filas[0]?.bender_path;
  if (!ruta) return null;

  const { url, key } = config();
  const res = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 300 }),
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('bender: no se pudo firmar el enlace', res.status, await res.text());
    return null;
  }
  const { signedURL } = (await res.json()) as { signedURL: string };
  return `${url}/storage/v1${signedURL}`;
}
