/**
 * La cookie de sesión del OS, leída desde una ruta o una pantalla.
 *
 * Pueden llegar dos con el mismo nombre: la de este host, de antes de que la
 * sesión valiera para todos los subdominios, y la nueva. Si la clave cambió en
 * el medio, la primera quedó vieja, y leer "la cookie" a secas devolvía esa:
 * la puerta dejaba pasar y la ruta contestaba "Sin sesión". Acá se miran todas
 * y se devuelve la que vale; si ninguna vale, la primera que haya.
 */

import 'server-only';
import { headers } from 'next/headers';
import { COOKIE, huella, igual } from '@/lib/os-sesion';

export async function cookieDelOs(): Promise<string | undefined> {
  const todas = ((await headers()).get('cookie') ?? '')
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c.startsWith(`${COOKIE}=`))
    .map((c) => c.slice(COOKIE.length + 1));
  const clave = process.env.OS_CLAVE;
  if (!clave || todas.length < 2) return todas[0];
  const esperada = await huella(clave);
  return todas.find((c) => igual(c, esperada)) ?? todas[0];
}
