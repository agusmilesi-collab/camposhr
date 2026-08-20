/**
 * Quién está trabajando y qué alcanza a ver.
 *
 * Es la costura por la que después entran las cuentas. Hoy la identidad la
 * elige quien mira, desde el pie de la barra lateral, y viaja en una cookie:
 * mientras se construye el sistema, tener que iniciar sesión para ver una
 * corrección cuesta más de lo que ordena.
 *
 * **Qué cambia el día que haya cuentas.** Solo `quienSoy`: en vez de leer la
 * cookie, lee la sesión. El equipo, el alcance y las pantallas quedan igual,
 * porque ya preguntan "¿quién soy?" y filtran por eso. Lo que hoy es una
 * preferencia pasa a ser un permiso.
 *
 * El equipo vive en `public.equipo` (ver `supabase/equipo.sql`), que es la
 * tabla de cuentas sin las cuentas.
 */

import 'server-only';
import { cookies } from 'next/headers';

export const COOKIE_IDENTIDAD = 'os_equipo';

export type Miembro = {
  nombre: string;
  /** 'todo' ve el trabajo de todas; 'propio' ve lo suyo. */
  alcance: 'todo' | 'propio';
  /** Con qué nombre figura en las evaluaciones. Nulo si no administra tests. */
  evaluadora: string | null;
};

/** Con quién se entra cuando la cookie está vacía. */
const POR_DEFECTO: Miembro = { nombre: 'Agustín', alcance: 'todo', evaluadora: null };

type Fila = {
  nombre: string;
  alcance: 'todo' | 'propio';
  evaluadoras: { nombre: string } | null;
};

/**
 * El equipo, con cinco minutos de caché.
 *
 * Son tres filas que casi nunca cambian y se piden en cada pantalla: sin la
 * caché, cada visita al OS suma un viaje a Supabase para nada.
 */
export async function equipo(): Promise<Miembro[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return [POR_DEFECTO];

  try {
    const res = await fetch(
      `${url}/rest/v1/equipo?select=nombre,alcance,evaluadoras(nombre)` +
        `&activo=is.true&order=orden.asc,nombre.asc`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return [POR_DEFECTO];
    const filas: Fila[] = await res.json();
    if (filas.length === 0) return [POR_DEFECTO];
    return filas.map((f) => ({
      nombre: f.nombre,
      alcance: f.alcance,
      evaluadora: f.evaluadoras?.nombre ?? null,
    }));
  } catch {
    return [POR_DEFECTO];
  }
}

/** Quién mira. Un nombre que ya no está en el equipo cae al de por defecto. */
export async function quienSoy(): Promise<Miembro> {
  const guardado = cookies().get(COOKIE_IDENTIDAD)?.value;
  const nombre = guardado ? decodeURIComponent(guardado) : '';
  const miembros = await equipo();
  return (
    miembros.find((m) => m.nombre === nombre) ??
    miembros.find((m) => m.alcance === 'todo') ??
    POR_DEFECTO
  );
}

/**
 * Qué ve cada quien.
 *
 * Las evaluaciones sin dueño las ve todo el mundo, porque el trabajo de esa
 * etapa es justamente asignarlas. Desde que tienen evaluadora, cada una
 * trabaja sobre lo suyo.
 */
export function esMia(evaluadora: string | null, yo: Miembro): boolean {
  if (yo.alcance === 'todo') return true;
  if (!evaluadora) return true;
  return yo.evaluadora ? evaluadora.includes(yo.evaluadora) : false;
}

/**
 * El nombre convertido en nombre de archivo: "Lorena Campos" -> "lorena-campos".
 *
 * La foto de cada quien vive en el bucket `selfies`, en `equipo/<slug>.jpg`. Es
 * una convención y no una columna a propósito: subir el archivo con ese nombre
 * alcanza para que aparezca, sin tocar la base ni el código.
 */
export function slugDe(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * La foto del miembro, firmada por una hora. Null si todavía no la subieron.
 *
 * El bucket es privado, así que la dirección se firma en el servidor: una foto
 * del equipo no tiene por qué quedar abierta a quien adivine la dirección.
 */
export async function fotoDe(nombre: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  try {
    const res = await fetch(
      `${url}/storage/v1/object/sign/selfies/equipo/${slugDe(nombre)}.jpg`,
      {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: 3600 }),
        next: { revalidate: 1800 },
      }
    );
    if (!res.ok) return null;
    const { signedURL, signedUrl } = await res.json();
    const firmada = signedUrl ?? signedURL;
    return firmada ? `${url}/storage/v1${firmada}` : null;
  } catch {
    return null;
  }
}
