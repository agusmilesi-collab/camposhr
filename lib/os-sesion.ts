/**
 * La puerta del OS. Es un interruptor: la prende la variable `OS_CLAVE`.
 *
 * **Con `OS_CLAVE` cargada** se pide la clave una vez por navegador y queda
 * una sesión de treinta días. **Sin la variable, el OS abre sin nada delante**,
 * que es como está mientras se prueba el sistema: pedir una clave para entrar
 * a mirar una corrección molesta más de lo que protege en esta etapa.
 *
 * Lo que hay que saber para decidir cuándo prenderla: sin puerta, quien
 * conozca la dirección ve nombres, teléfonos y correos de candidatos. Ese es
 * el material que hay hoy; el clínico todavía no se muestra en ninguna
 * pantalla, justamente porque no hay identidad de quien lo mira.
 *
 * La cookie no guarda la clave sino su huella, así el navegador nunca tiene
 * el secreto.
 */

export const COOKIE = 'os_sesion';

/** Hay puerta solo si hay clave configurada. */
export function hayPuerta(): boolean {
  return Boolean(process.env.OS_CLAVE);
}

/**
 * El hub de herramientas pide la misma sesión que el OS.
 *
 * Ahí viven los enlaces de portal de cada cliente, las cotizaciones y lo que
 * respondió cada persona en los cuestionarios: con la puerta solo en el host
 * del OS, todo eso se abría sin clave desde el de al lado.
 */
export const HOST_TOOLS = 'tools.camposhr.com';

/**
 * A dónde se vuelve después de entrar: una pantalla del OS o una del hub.
 *
 * Cualquier otra cosa cae en la home. Sin esto, un enlace armado desde afuera
 * podría usar la puerta para redirigir a otro sitio.
 */
export function destinoPermitido(destino: string): string {
  if (destino.startsWith(`https://${HOST_TOOLS}/`)) return destino;
  return destino.startsWith('/os') ? destino : '/os';
}

/**
 * El dominio de la cookie de sesión.
 *
 * En producción vale para todos los subdominios, que es lo que hace que entrar
 * al OS alcance para el hub. En local no lleva dominio.
 */
export function dominioDeCookie(host: string): string | undefined {
  return host.toLowerCase().split(':')[0].endsWith('camposhr.com') ? '.camposhr.com' : undefined;
}

/** Treinta días: se entra desde la misma máquina todos los días. */
export const DURACION = 60 * 60 * 24 * 30;

/** La huella que viaja en la cookie. Web Crypto, así corre en el middleware. */
export async function huella(clave: string): Promise<string> {
  // Con `OS_SECRETO` cargado, la huella lleva además un valor que solo conoce
  // el servidor. La clave del equipo es corta: sin esto, quien quiera entrar no
  // necesita ni pasar por la pantalla de ingreso, le alcanza con calcular la
  // huella de cada clave posible y probarlas como cookie.
  const secreto = process.env.OS_SECRETO;
  const datos = new TextEncoder().encode(
    secreto ? `campos-os:${secreto}:${clave}` : `campos-os:${clave}`
  );
  const hash = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Comparación en tiempo constante, para no filtrar la clave por el reloj. */
export function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/**
 * El navegador que ya entró una vez.
 *
 * El tope general de intentos frena a quien prueba claves cambiando de
 * dirección en cada intento, pero mientras corre deja afuera también al
 * equipo, y cualquiera podía provocarlo a propósito errando treinta veces. Un
 * navegador que alguna vez entró bien lleva esta marca y no cuenta para ese
 * tope: sigue frenado por el de su dirección, como todos.
 *
 * La marca no abre nada por sí sola: solo dice que este navegador ya supo la
 * clave alguna vez. Va firmada con `OS_SECRETO` y no con la clave, así que
 * cambiar la clave no la invalida, que es justo cuando el equipo vuelve a
 * pasar por la puerta.
 */
export const COOKIE_CONOCIDO = 'os_conocido';

/** Un año: es una marca del navegador, no una sesión. */
export const DURACION_CONOCIDO = 60 * 60 * 24 * 365;

async function firma(texto: string): Promise<string | null> {
  const secreto = process.env.OS_SECRETO;
  if (!secreto) return null;
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sello = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(`conocido:${texto}`));
  return Array.from(new Uint8Array(sello))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Una marca nueva: un número al azar y su firma. Sin `OS_SECRETO` no hay marca. */
export async function marcaDeConocido(): Promise<string | null> {
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const sello = await firma(id);
  return sello ? `${id}.${sello}` : null;
}

/** Si alguna de las marcas que mandó el navegador es auténtica. */
export async function esConocido(valores: string[]): Promise<boolean> {
  for (const valor of valores) {
    const [id, sello] = valor.split('.');
    if (!id || !sello || !/^[0-9a-f]{32}$/.test(id)) continue;
    const esperado = await firma(id);
    if (esperado && igual(sello, esperado)) return true;
  }
  return false;
}
