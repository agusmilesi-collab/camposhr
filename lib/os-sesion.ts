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

/** Treinta días: se entra desde la misma máquina todos los días. */
export const DURACION = 60 * 60 * 24 * 30;

/** La huella que viaja en la cookie. Web Crypto, así corre en el middleware. */
export async function huella(clave: string): Promise<string> {
  const datos = new TextEncoder().encode(`campos-os:${clave}`);
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
