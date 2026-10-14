/**
 * Cifrado de secretos que se guardan en la base.
 *
 * Hoy lo usa el permiso de Google de cada evaluadora (`google_calendario`):
 * con ese permiso se escribe en su calendario y en sus contactos, así que quien
 * lea la tabla (una copia de respaldo, una clave de Supabase filtrada) no tiene
 * que poder usarlo. La clave vive solo en las variables de entorno
 * (`GOOGLE_TOKEN_CLAVE`, 32 bytes en base64), nunca en la base.
 *
 * AES-256-GCM: además de esconder el valor, rechaza uno que alguien haya
 * cambiado en la tabla. Lo guardado lleva delante `v1:` para distinguirlo del
 * texto plano que había antes y para poder cambiar de método sin ambigüedad.
 */

import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIJO = 'v1:';

function clave(): Buffer {
  const k = Buffer.from(process.env.GOOGLE_TOKEN_CLAVE ?? '', 'base64');
  if (k.length !== 32) throw new Error('Falta GOOGLE_TOKEN_CLAVE (32 bytes en base64).');
  return k;
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', clave(), iv);
  const datos = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return PREFIJO + Buffer.concat([iv, c.getAuthTag(), datos]).toString('base64');
}

/**
 * Lo guardado, en claro. Un valor sin prefijo es de antes del cifrado y se
 * devuelve tal cual: así nada se corta mientras se cifran las filas viejas.
 */
export function descifrar(guardado: string): string {
  if (!guardado.startsWith(PREFIJO)) return guardado;
  const b = Buffer.from(guardado.slice(PREFIJO.length), 'base64');
  const d = createDecipheriv('aes-256-gcm', clave(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}

export function estaCifrado(guardado: string): boolean {
  return guardado.startsWith(PREFIJO);
}
