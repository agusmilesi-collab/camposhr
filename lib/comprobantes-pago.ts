import 'server-only';
import { insert, patch, select } from '@/lib/supabase';
import { recargoDelDia, signo, type Movimiento } from '@/lib/consultorios-calculo';

/**
 * Los comprobantes de transferencia que sube el inquilino.
 *
 * Van al bucket privado y se abren con un enlace firmado y corto: un
 * comprobante trae el nombre, el CBU y el banco de quien transfirió.
 *
 * Subir uno no registra ningún pago. Ver `supabase/comprobantes-pago.sql`.
 */

const BUCKET = 'psicotecnicos';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo que entra en una petición a Vercel, con margen. Las fotos llegan ya
 *  achicadas desde el navegador; un PDF de banco pesa unos cientos de kilos. */
export const PESO_MAXIMO = 4 * 1024 * 1024;

const EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heic',
};

export type Comprobante = {
  id: string;
  inquilino_id: string;
  periodo: string;
  nombre: string;
  created_at: string;
};

function config(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');
  return { url, key };
}

export async function guardarComprobante(
  inquilinoId: string,
  periodo: string,
  archivo: File
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const extension = EXTENSION[archivo.type];
  if (!extension) return { ok: false, motivo: 'Tiene que ser un PDF o una foto.' };
  if (archivo.size === 0) return { ok: false, motivo: 'El archivo está vacío.' };
  if (archivo.size > PESO_MAXIMO) return { ok: false, motivo: 'El archivo pesa más de 4 MB.' };

  const { url, key } = config();
  // El nombre del archivo no entra en la ruta: viene del teléfono de la
  // persona y puede traer cualquier cosa. Se guarda aparte, para mostrarlo.
  const ruta = `consultorios/comprobantes/${inquilinoId}/${crypto.randomUUID()}.${extension}`;
  const subida = await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': archivo.type },
    body: new Uint8Array(await archivo.arrayBuffer()),
    cache: 'no-store',
  });
  if (!subida.ok) {
    throw new Error(`No se pudo subir el comprobante: ${subida.status} ${await subida.text()}`);
  }
  await insert('comprobantes_pago', {
    inquilino_id: inquilinoId,
    periodo,
    ruta,
    nombre: archivo.name.slice(0, 120) || `comprobante.${extension}`,
  });
  return { ok: true };
}

export async function comprobantesDe(inquilinoId: string): Promise<Comprobante[]> {
  if (!UUID.test(inquilinoId)) return [];
  return select<Comprobante>(
    'comprobantes_pago',
    `select=id,inquilino_id,periodo,nombre,created_at&inquilino_id=eq.${inquilinoId}&order=created_at.desc`
  );
}

/**
 * El enlace para abrir uno, firmado y corto.
 *
 * Con `inquilinoId` solo abre si es de esa persona: es lo que usa la zona del
 * inquilino, donde el identificador del comprobante viene de la dirección.
 */
export async function enlaceDelComprobante(id: string, inquilinoId?: string): Promise<string | null> {
  if (!UUID.test(id)) return null;
  const filas = await select<{ ruta: string; inquilino_id: string }>(
    'comprobantes_pago',
    `select=ruta,inquilino_id&id=eq.${id}&limit=1`
  );
  const fila = filas[0];
  if (!fila || (inquilinoId && fila.inquilino_id !== inquilinoId)) return null;

  const { url, key } = config();
  const res = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${fila.ruta}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 300 }),
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('comprobante: no se pudo firmar el enlace', res.status, await res.text());
    return null;
  }
  const { signedURL } = (await res.json()) as { signedURL: string };
  return `${url}/storage/v1${signedURL}`;
}

/**
 * Los que esperan que alguien registre el pago, con el nombre de quien subió.
 *
 * Es lo que sale como aviso en Inicio. Del más viejo al más nuevo: el que
 * espera hace más tiempo va arriba.
 */
export async function comprobantesSinRegistrar(): Promise<
  (Comprobante & { inquilino: string })[]
> {
  const filas = await select<Comprobante & { inquilinos: { nombre: string } | null }>(
    'comprobantes_pago',
    'select=id,inquilino_id,periodo,nombre,created_at,inquilinos(nombre)' +
      '&registrado_at=is.null&order=created_at.asc'
  );
  return filas.map(({ inquilinos, ...c }) => ({ ...c, inquilino: inquilinos?.nombre ?? 'Sin nombre' }));
}

/** Al registrar un pago, los comprobantes de esa persona para ese mes dejan de
 *  ser un aviso: ya se hizo lo que pedían. */
export async function darPorRegistrados(inquilinoId: string, periodo: string): Promise<void> {
  await patch(
    'comprobantes_pago',
    `inquilino_id=eq.${inquilinoId}&periodo=eq.${periodo}&registrado_at=is.null`,
    { registrado_at: new Date().toISOString() }
  );
}

/** El día de Argentina en que se subió: es el día en que la persona pagó. */
export function diaDeSubida(c: { created_at: string }): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Cordoba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(c.created_at));
}

/**
 * Cuánto tiene que haber transferido quien subió ese comprobante.
 *
 * Es el saldo de ese mes más el recargo que corría **el día en que lo subió**,
 * no el del día en que el equipo lo mira: quien transfirió el 9 y es atendido
 * el 12 pagó en término.
 *
 * Lo usan la tarjeta de Inicio, para mostrar contra qué comparar el papel, y la
 * ruta que registra el pago, que vuelve a hacer la cuenta y no confía en el
 * número que mandó la pantalla.
 */
export async function loQueDebe(c: {
  inquilino_id: string;
  periodo: string;
  created_at: string;
}): Promise<{ saldo: number; recargo: number; total: number; fecha: string }> {
  const filas = await select<Pick<Movimiento, 'tipo' | 'importe'>>(
    'movimientos',
    `select=tipo,importe&inquilino_id=eq.${c.inquilino_id}&periodo=eq.${c.periodo}`
  );
  const saldo = Math.max(0, filas.reduce((n, m) => n + signo(m.tipo) * Number(m.importe), 0));
  const fecha = diaDeSubida(c);
  const recargo = Math.round((saldo * recargoDelDia(fecha, c.periodo)) / 100);
  return { saldo, recargo, total: saldo + recargo, fecha };
}

export async function comprobantePorId(id: string): Promise<Comprobante | null> {
  if (!UUID.test(id)) return null;
  const filas = await select<Comprobante & { registrado_at: string | null }>(
    'comprobantes_pago',
    `select=id,inquilino_id,periodo,nombre,created_at,registrado_at&id=eq.${id}&limit=1`
  );
  return filas[0] && !filas[0].registrado_at ? filas[0] : null;
}
