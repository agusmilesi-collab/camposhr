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
import { siEstaTodoTomado } from '@/lib/entrevista-completa';

const BUCKET = 'psicotecnicos';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function config(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');
  return { url, key };
}

/**
 * Borra el informe que hubiera quedado de antes.
 *
 * El PDF ya no se guarda, pero las evaluaciones cargadas hasta el 21/8/2026
 * tienen el suyo en el bucket. Al volver a cargar una de esas, el archivo se
 * va: la fila queda con los datos leídos y sin adjunto, igual que las nuevas.
 */
async function borrarPdf(ruta: string): Promise<void> {
  const { url, key } = config();
  await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  }).catch(() => {});
}

export type BenzigerCarga = {
  /**
   * Los códigos de los cuadrantes preferentes: FI, FD, BI, BD.
   *
   * Uno o dos, y el orden lleva la jerarquía: el primero es el que manda.
   */
  cuadrantes: string[];
  /** Si los dos pesan lo mismo. Con `false`, manda el primero de la lista. */
  parejos?: boolean;
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
): Promise<{ ok: true; conInforme: boolean } | { ok: false; motivo: string }> {
  if (!UUID.test(evaluacionId)) return { ok: false, motivo: 'Evaluación inválida.' };

  const fila: Record<string, unknown> = {
    evaluacion_id: evaluacionId,
    cuadrante_preferente: c.cuadrantes,
    // Con menos de dos no hay nada que emparejar: guardarlo en true dejaría el
    // dato listo para mentir en cuanto alguien agregue el segundo.
    cuadrantes_parejos: c.cuadrantes.length === 2 ? Boolean(c.parejos) : false,
    actualizado_at: new Date().toISOString(),
  };
  if (c.pdf) {
    // El PDF no se guarda. Ya se le sacaron los 69 datos que trae, y el
    // original queda en la plataforma Benziger, que es de donde salió: tenerlo
    // acá además no agrega nada y suma una copia del perfil completo de una
    // persona identificable. Del archivo queda el nombre y la fecha, para que
    // la ficha muestre cuál fue el informe que se leyó.
    fila.pdf_path = null;
    fila.pdf_nombre = c.pdf.name;
    const previas = await select<{ pdf_path: string | null }>(
      'benziger',
      `select=pdf_path&evaluacion_id=eq.${evaluacionId}&limit=1`
    );
    if (previas[0]?.pdf_path) await borrarPdf(previas[0].pdf_path);
  }
  if (c.leido) {
    fila.cuadrantes = c.leido.cuadrantes;
    fila.adjetivos = c.leido.adjetivos;
    fila.abiertas = c.leido.abiertas;
    fila.estres = c.leido.estres;
  }

  // Cargar el informe es haberlo tomado: la marca vive en la evaluación porque
  // el Benziger no está en la batería, lo agrega el pedido cuando lo lleva.
  if (c.leido) {
    const { url: u, key: k } = config();
    await fetch(`${u}/rest/v1/evaluaciones?id=eq.${evaluacionId}`, {
      method: 'PATCH',
      headers: {
        apikey: k,
        Authorization: `Bearer ${k}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ benziger_administrado: true }),
      cache: 'no-store',
    });
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
  await siEstaTodoTomado(evaluacionId);
  return { ok: true, conInforme: Boolean(c.pdf) };
}
