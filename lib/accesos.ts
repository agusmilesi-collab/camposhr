/**
 * El registro de quién tocó qué.
 *
 * Es la mitad del requisito que manda los datos de personas a Supabase: sin
 * constancia de lectura da igual dónde estén guardados. Escribe en la tabla
 * `public.accesos` con la service key.
 *
 * **`quien` todavía dice 'equipo'.** El OS entra con una clave compartida, así
 * que no hay a quién anotar. El registro se deja andando desde ahora para que
 * el día que exista una cuenta por psicóloga solo cambie este valor, y no haya
 * que salir a instrumentar cada lectura.
 *
 * No tira nunca: si el registro falla, la pantalla igual tiene que funcionar.
 * El fallo se escribe en el log del servidor.
 */

import 'server-only';

export type Acceso = {
  accion: 'lectura' | 'escritura' | 'descarga' | 'borrado';
  recurso: string;
  recursoId?: string | null;
  detalle?: Record<string, unknown>;
  quien?: string;
};

/**
 * Cuándo se anotó por última vez cada lectura repetida.
 *
 * Sin esto, moverse entre las seis etapas escribía seis filas iguales y le
 * sumaba a cada pantalla el viaje de ida y vuelta de esa escritura. Lo que el
 * registro tiene que poder contestar es quién miró el trabajo de qué cliente y
 * cuándo, y para eso una marca cada cinco minutos alcanza.
 *
 * Las escrituras nunca se agrupan: cada cambio deja su fila.
 */
const ultimaLectura = new Map<string, number>();
const CADA = 5 * 60 * 1000;

function esRepetida(a: Acceso, ahora: number): boolean {
  if (a.accion !== 'lectura') return false;
  const clave = `${a.quien ?? 'equipo'}|${a.recurso}|${JSON.stringify(a.detalle ?? {})}`;
  const previa = ultimaLectura.get(clave);
  if (previa && ahora - previa < CADA) return true;
  ultimaLectura.set(clave, ahora);
  return false;
}

export async function anotarAcceso(a: Acceso): Promise<void> {
  if (esRepetida(a, Date.now())) return;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;

  try {
    const res = await fetch(`${url}/rest/v1/accesos`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        quien: a.quien ?? 'equipo',
        accion: a.accion,
        recurso: a.recurso,
        recurso_id: a.recursoId ?? null,
        detalle: a.detalle ?? {},
      }),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('accesos: Supabase respondió', res.status, await res.text());
    }
  } catch (e) {
    console.error('accesos: no se pudo anotar', e);
  }
}
