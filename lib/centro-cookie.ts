/**
 * La sesión del inquilino, del lado de la cookie.
 *
 * Vive aparte de `lib/centro-acceso.ts` porque el middleware corre en el borde,
 * donde no hay `node:crypto`: acá solo se usa Web Crypto, que existe en los dos
 * lados.
 *
 * La cookie lleva el identificador de la persona, hasta cuándo vale y una
 * firma. Sin firma, quien la edite entra como cualquier otro: el identificador
 * es público en cuanto se mira el navegador, así que lo que hace de secreto es
 * `CENTRO_SECRETO`.
 *
 * **Vence y se corta al cambiar la contraseña.** La firma cubre también la
 * fecha y la huella de la contraseña guardada. Antes la cookie era el
 * identificador firmado y nada más: una copia servía para siempre, y cambiar
 * la contraseña no la invalidaba.
 *
 * **Falla cerrada.** Sin esa variable no hay sesión válida, y la zona del
 * inquilino queda inaccesible en vez de abrirse sin puerta como hace el OS
 * mientras se prueba. Acá adentro hay plata y datos de terceros.
 */

export const COOKIE = 'centro_sesion';

/**
 * Noventa días. Es la red para la sesión que quedó abierta sin que nadie se
 * diera cuenta (la computadora del consultorio, un teléfono perdido): para el
 * caso conocido está cambiar la contraseña, que corta todas las sesiones en el
 * acto. Pide la contraseña unas cuatro veces por año y no hace falta enlace.
 */
export const DURACION = 60 * 60 * 24 * 90;

async function firmar(texto: string, secreto: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(firma))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `hash` es la contraseña guardada de esa persona, tal como está en la base. */
export async function armarCookie(
  inquilinoId: string,
  hash: string | null,
  secreto: string
): Promise<string> {
  const vence = Math.floor(Date.now() / 1000) + DURACION;
  return `${inquilinoId}.${vence}.${await firmar(`${inquilinoId}.${vence}.${hash ?? ''}`, secreto)}`;
}

/**
 * De quién dice ser la cookie, si todavía no venció. No prueba nada: la firma
 * se comprueba después, con `firmaValida`, cuando ya se leyó su contraseña.
 */
export function idDeLaCookie(valor: string | undefined): string | null {
  const [id, vence, firma] = (valor ?? '').split('.');
  if (!id || !vence || !firma || !ID.test(id)) return null;
  if (!/^\d{9,12}$/.test(vence) || Number(vence) < Date.now() / 1000) return null;
  return id;
}

/** Si la cookie la firmó este servidor para esa persona, con esa contraseña. */
export async function firmaValida(
  valor: string | undefined,
  hash: string | null,
  secreto: string | undefined
): Promise<boolean> {
  if (!valor || !secreto) return false;
  const [id, vence, firma] = valor.split('.');
  if (!id || !vence || !firma) return false;
  const esperada = await firmar(`${id}.${vence}.${hash ?? ''}`, secreto);
  if (firma.length !== esperada.length) return false;
  let dif = 0;
  for (let i = 0; i < firma.length; i++) dif |= firma.charCodeAt(i) ^ esperada.charCodeAt(i);
  return dif === 0;
}
