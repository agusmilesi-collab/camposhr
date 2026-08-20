/**
 * Acceso a Supabase — SIEMPRE server-side, con la service key.
 *
 * Sin SDK: la API REST (PostgREST) y la de Storage se resuelven con fetch,
 * igual que el acceso a Airtable. La service key saltea RLS, así que este
 * módulo no puede importarse nunca desde un componente de cliente.
 */

import 'server-only';

const URL_BASE = () => {
  const u = process.env.SUPABASE_URL;
  if (!u) throw new Error('Falta SUPABASE_URL en las variables de entorno.');
  return u.replace(/\/$/, '');
};

const KEY = () => {
  const k = process.env.SUPABASE_SERVICE_KEY;
  if (!k) throw new Error('Falta SUPABASE_SERVICE_KEY en las variables de entorno.');
  return k;
};

function headers(extra: Record<string, string> = {}) {
  const k = KEY();
  return { apikey: k, Authorization: `Bearer ${k}`, ...extra };
}

/**
 * SELECT sobre una tabla. `query` son parámetros de PostgREST ya armados.
 *
 * Por defecto no cachea: la mayoría de las pantallas que leen de acá son de
 * sala, donde un dato de hace un minuto ya no sirve. `etiqueta` la vuelve
 * cacheable y le pone un nombre para poder invalidarla cuando algo se escribe,
 * que es lo que hace que moverse entre pantallas no vuelva a pedir todo.
 */
export async function select<T>(
  tabla: string,
  query: string,
  etiqueta?: string
): Promise<T[]> {
  const res = await fetch(`${URL_BASE()}/rest/v1/${tabla}?${query}`, {
    headers: headers(),
    ...(etiqueta
      ? { next: { revalidate: 300, tags: [etiqueta] } }
      : { cache: 'no-store' as const }),
  });
  if (!res.ok) throw new Error(`Supabase ${tabla} ${res.status}: ${await res.text()}`);
  return res.json();
}

/** INSERT de una fila. Devuelve la fila creada. */
export async function insert<T>(
  tabla: string,
  fila: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${URL_BASE()}/rest/v1/${tabla}`, {
    method: 'POST',
    headers: headers({
      'content-type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(fila),
  });
  if (!res.ok) throw new Error(`Supabase insert ${tabla} ${res.status}: ${await res.text()}`);
  const filas = await res.json();
  return filas[0];
}

/** UPDATE sobre las filas que matchea `query`. */
export async function patch(
  tabla: string,
  query: string,
  cambios: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${URL_BASE()}/rest/v1/${tabla}?${query}`, {
    method: 'PATCH',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify(cambios),
  });
  if (!res.ok) throw new Error(`Supabase patch ${tabla} ${res.status}: ${await res.text()}`);
}

/**
 * INSERT que pisa la fila anterior cuando choca con una clave única.
 *
 * `conflicto` son las columnas de esa clave. Es lo que hace que responder dos
 * veces la misma actividad corrija la respuesta en lugar de duplicarla.
 */
export async function upsert<T>(
  tabla: string,
  fila: Record<string, unknown>,
  conflicto: string
): Promise<T> {
  const res = await fetch(
    `${URL_BASE()}/rest/v1/${tabla}?on_conflict=${conflicto}`,
    {
      method: 'POST',
      headers: headers({
        'content-type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      }),
      body: JSON.stringify(fila),
    }
  );
  if (!res.ok) throw new Error(`Supabase upsert ${tabla} ${res.status}: ${await res.text()}`);
  const filas = await res.json();
  return filas[0];
}

/** El mismo upsert, para varias filas de una. Devuelve las filas escritas. */
export async function upsertVarias<T>(
  tabla: string,
  filas: Record<string, unknown>[],
  conflicto: string
): Promise<T[]> {
  if (filas.length === 0) return [];
  const res = await fetch(
    `${URL_BASE()}/rest/v1/${tabla}?on_conflict=${conflicto}`,
    {
      method: 'POST',
      headers: headers({
        'content-type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      }),
      body: JSON.stringify(filas),
    }
  );
  if (!res.ok) throw new Error(`Supabase upsert ${tabla} ${res.status}: ${await res.text()}`);
  return res.json();
}

// ------------------------------------------------------------------ tipos

export type Empresa = {
  id: string;
  nombre: string;
  slug: string;
  activa: boolean;
};

export type Lider = {
  id: string;
  empresa_id: string;
  nombre: string;
  activo: boolean;
  /** Enlace propio del líder para ver el playbook de su equipo. */
  token: string | null;
};

/** Variantes del cuestionario. 'generaciones' suma 4 placas y pide el líder. */
export type Variante = 'perfil' | 'generaciones';

export type Respuesta = {
  id: string;
  empresa_id: string;
  variante: Variante;
  lider_id: string | null;
  lider_nombre: string | null;
  apellido: string | null;
  nombre: string;
  totales: Record<string, number>;
  perfiles: string[];
  resultado: string;
  eje_x: number;
  eje_y: number;
  generacion: string | null;
  foto_path: string | null;
  created_at: string;
  /** El dictado en el que se respondió. Null si fue desde el enlace suelto. */
  corrida_id: string | null;
  /** Quién la respondió, cuando fue desde la pantalla del encuentro. */
  asistente_id: string | null;
};

/**
 * El cuadrante que encabeza el resultado de cada asistente de una corrida.
 *
 * Es lo que hace falta para cruzar a la gente en la charla 3, y sale de la
 * respuesta al cuestionario que dieron un rato antes, en esa misma sala. Se
 * queda con la última de cada uno: si alguien lo rehízo, vale la que corrigió.
 */
export async function perfilesDeCorrida(
  corridaId: string
): Promise<Map<string, string>> {
  const filas = await select<{ asistente_id: string | null; perfiles: string[] }>(
    'respuestas',
    `select=asistente_id,perfiles&corrida_id=eq.${corridaId}` +
      `&asistente_id=not.is.null&order=created_at.asc`
  );
  const out = new Map<string, string>();
  for (const f of filas) {
    if (f.asistente_id && f.perfiles?.[0]) out.set(f.asistente_id, f.perfiles[0]);
  }
  return out;
}

// ---------------------------------------------------------------- consultas

const SLUG_VALIDO = /^[a-z0-9-]{2,60}$/;

export async function listarEmpresas(): Promise<Empresa[]> {
  return select<Empresa>(
    'empresas',
    'select=id,nombre,slug,activa&activa=eq.true&order=nombre.asc'
  );
}

export async function getEmpresaPorSlug(slug: string): Promise<Empresa | null> {
  if (!SLUG_VALIDO.test(slug)) return null;
  const filas = await select<Empresa>(
    'empresas',
    `select=id,nombre,slug,activa&slug=eq.${slug}&activa=eq.true&limit=1`
  );
  return filas[0] ?? null;
}

export async function listarLideres(empresaId: string): Promise<Lider[]> {
  return select<Lider>(
    'lideres',
    `select=id,empresa_id,nombre,activo,token&empresa_id=eq.${empresaId}` +
      `&activo=eq.true&order=nombre.asc`
  );
}

const TOKEN_LIDER = /^[a-f0-9]{16,64}$/;

/** Resuelve el enlace de un líder. Devuelve el líder y su empresa. */
export async function getLiderPorToken(
  token: string
): Promise<(Lider & { empresa: Empresa }) | null> {
  if (!TOKEN_LIDER.test(token)) return null;
  const filas = await select<Lider & { empresas: Empresa }>(
    'lideres',
    `select=id,empresa_id,nombre,activo,token,empresas(id,nombre,slug,activa)` +
      `&token=eq.${token}&activo=eq.true&limit=1`
  );
  const l = filas[0];
  if (!l) return null;
  const { empresas, ...resto } = l;
  return { ...resto, empresa: empresas };
}

/** Respuestas del equipo de un líder. */
export async function listarEquipo(liderId: string): Promise<Respuesta[]> {
  return select<Respuesta>(
    'respuestas',
    `select=${CAMPOS_RESPUESTA}&lider_id=eq.${liderId}&order=nombre.asc`
  );
}

const CAMPOS_RESPUESTA =
  'id,empresa_id,variante,lider_id,lider_nombre,apellido,nombre,totales,perfiles,' +
  'resultado,eje_x,eje_y,generacion,foto_path,created_at,corrida_id,asistente_id';

/**
 * Las respuestas de una empresa.
 *
 * `corridaId` acota a un dictado: la misma empresa puede recorrer el ciclo más
 * de una vez, y la matriz que se proyecta en la sala tiene que mostrar al
 * grupo que está ahí, no a todos los que alguna vez respondieron.
 */
export async function listarRespuestas(
  empresaId: string,
  variante?: Variante,
  corridaId?: string
): Promise<Respuesta[]> {
  const filtro = variante ? `&variante=eq.${variante}` : '';
  const deLaCorrida = corridaId ? `&corrida_id=eq.${corridaId}` : '';
  return select<Respuesta>(
    'respuestas',
    `select=${CAMPOS_RESPUESTA}&empresa_id=eq.${empresaId}${filtro}${deLaCorrida}` +
      `&order=created_at.asc`
  );
}

/** Todo lo guardado de una empresa, incluido el detalle crudo, para exportar. */
export async function exportarRespuestas(
  empresaId: string
): Promise<(Respuesta & { detalle: unknown; extra: unknown })[]> {
  return select(
    'respuestas',
    `select=${CAMPOS_RESPUESTA},detalle,extra&empresa_id=eq.${empresaId}&order=created_at.asc`
  );
}

export async function contarRespuestas(
  empresaId: string,
  corridaId?: string
): Promise<number> {
  const deLaCorrida = corridaId ? `&corrida_id=eq.${corridaId}` : '';
  const res = await fetch(
    `${URL_BASE()}/rest/v1/respuestas?select=id&empresa_id=eq.${empresaId}${deLaCorrida}`,
    {
      headers: headers({ Prefer: 'count=exact', Range: '0-0' }),
      cache: 'no-store',
    }
  );
  if (!res.ok) return 0;
  const rango = res.headers.get('content-range') ?? '';
  const total = Number(rango.split('/')[1]);
  return Number.isFinite(total) ? total : 0;
}

export async function guardarRespuesta(fila: {
  empresa_id: string;
  variante: Variante;
  lider_id: string | null;
  lider_nombre: string | null;
  apellido: string | null;
  nombre: string;
  likert: Record<string, number>;
  checklist: Record<string, number>;
  totales: Record<string, number>;
  detalle: unknown;
  perfiles: string[];
  resultado: string;
  eje_x: number;
  eje_y: number;
  extra: unknown;
  generacion: string | null;
  foto_path: string | null;
  /** El dictado, cuando se responde adentro de un encuentro. */
  corrida_id?: string | null;
  /** Quién respondió, cuando se responde adentro de un encuentro. Es lo que
   *  permite cruzar a la gente por cuadrante en la misma charla. */
  asistente_id?: string | null;
}): Promise<Respuesta> {
  return insert<Respuesta>('respuestas', fila);
}

// ----------------------------------------------------------------- storage

const BUCKET = 'selfies';

/** Sube la selfie al bucket privado. Devuelve la ruta guardada. */
export async function subirSelfie(
  ruta: string,
  archivo: ArrayBuffer,
  contentType: string
): Promise<string> {
  const res = await fetch(`${URL_BASE()}/storage/v1/object/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: headers({
      'content-type': contentType,
      'x-upsert': 'true',
      // La foto no cambia nunca: que el navegador la guarde y no la vuelva a
      // pedir en cada refresco de la matriz.
      'cache-control': 'max-age=604800',
    }),
    body: archivo,
  });
  if (!res.ok) throw new Error(`Supabase storage ${res.status}: ${await res.text()}`);
  return ruta;
}

/**
 * URLs firmadas para mostrar las selfies en la matriz interna.
 *
 * Las firmas se guardan en memoria y se reutilizan: si cada refresco generara
 * una URL nueva, el navegador volvería a descargar todas las fotos cada 15
 * segundos y el egress se dispararía. Con la URL estable, la matriz proyectada
 * baja cada selfie una sola vez.
 */
const firmasEnMemoria = new Map<string, { url: string; vence: number }>();

export async function firmarSelfies(
  rutas: string[],
  segundos = 60 * 60 * 24 * 7 // una semana
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (rutas.length === 0) return out;

  const ahora = Date.now();
  const faltantes: string[] = [];
  for (const ruta of rutas) {
    const guardada = firmasEnMemoria.get(ruta);
    if (guardada && guardada.vence > ahora) out.set(ruta, guardada.url);
    else faltantes.push(ruta);
  }
  if (faltantes.length === 0) return out;

  const res = await fetch(`${URL_BASE()}/storage/v1/object/sign/${BUCKET}`, {
    method: 'POST',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({ expiresIn: segundos, paths: faltantes }),
    cache: 'no-store',
  });
  if (!res.ok) return out;

  // Se renueva antes de que expire, para no servir una URL ya vencida.
  const vence = ahora + segundos * 1000 * 0.8;
  for (const item of await res.json()) {
    if (item?.path && item?.signedURL) {
      const url = `${URL_BASE()}/storage/v1${item.signedURL}`;
      out.set(item.path, url);
      firmasEnMemoria.set(item.path, { url, vence });
    }
  }
  return out;
}

/** El detalle crudo de una respuesta: las frases que marcó en cada placa. */
export async function detalleDe(id: string): Promise<unknown> {
  const filas = await select<{ detalle: unknown }>(
    'respuestas',
    `select=detalle&id=eq.${id}&limit=1`
  );
  return filas[0]?.detalle ?? null;
}
