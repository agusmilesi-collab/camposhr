/**
 * La sesión del inquilino, del lado de la cookie.
 *
 * Vive aparte de `lib/centro-acceso.ts` porque el middleware corre en el borde,
 * donde no hay `node:crypto`: acá solo se usa Web Crypto, que existe en los dos
 * lados.
 *
 * La cookie lleva el identificador de la persona y una firma. Sin firma, quien
 * la edite entra como cualquier otro: el identificador es público en cuanto se
 * mira el navegador, así que lo que hace de secreto es `CENTRO_SECRETO`.
 *
 * **Falla cerrada.** Sin esa variable no hay sesión válida, y la zona del
 * inquilino queda inaccesible en vez de abrirse sin puerta como hace el OS
 * mientras se prueba. Acá adentro hay plata y datos de terceros.
 */

export const COOKIE = 'centro_sesion';

/** Treinta días: se entra desde el mismo teléfono todas las semanas. */
export const DURACION = 60 * 60 * 24 * 30;

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

export async function armarCookie(inquilinoId: string, secreto: string): Promise<string> {
  return `${inquilinoId}.${await firmar(inquilinoId, secreto)}`;
}

/** El identificador de quien mira, o null si la cookie no está firmada por acá. */
export async function deLaCookie(valor: string | undefined, secreto: string | undefined): Promise<string | null> {
  if (!valor || !secreto) return null;
  const corte = valor.lastIndexOf('.');
  if (corte < 1) return null;
  const id = valor.slice(0, corte);
  const firma = valor.slice(corte + 1);
  const esperada = await firmar(id, secreto);
  if (firma.length !== esperada.length) return null;
  let dif = 0;
  for (let i = 0; i < firma.length; i++) dif |= firma.charCodeAt(i) ^ esperada.charCodeAt(i);
  return dif === 0 ? id : null;
}
