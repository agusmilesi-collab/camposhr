/**
 * La contraseña del inquilino: cómo se guarda y cómo se comprueba.
 *
 * `scrypt` de Node, sin dependencias nuevas. El formato es
 * `scrypt$<sal>$<huella>`, con la sal por persona: dos contraseñas iguales dan
 * huellas distintas, así que la base no delata quién repitió la de otro.
 *
 * La comparación es en tiempo constante. Una que corta al primer byte distinto
 * dice, por lo que tarda, cuánto acertó quien prueba.
 */

import 'server-only';

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const LARGO = 32;

function huella(clave: string, sal: string): Promise<Buffer> {
  return new Promise((listo, falla) => {
    scrypt(clave, sal, LARGO, (e, derivada) => (e ? falla(e) : listo(derivada)));
  });
}

export async function guardarClave(clave: string): Promise<string> {
  const sal = randomBytes(16).toString('hex');
  const h = await huella(clave, sal);
  return `scrypt$${sal}$${h.toString('hex')}`;
}

export async function claveCorrecta(clave: string, guardada: string | null): Promise<boolean> {
  if (!guardada) return false;
  const [tipo, sal, esperada] = guardada.split('$');
  if (tipo !== 'scrypt' || !sal || !esperada) return false;
  const h = await huella(clave, sal);
  const otra = Buffer.from(esperada, 'hex');
  if (otra.length !== h.length) return false;
  return timingSafeEqual(h, otra);
}

/** El enlace de un solo uso para poner o restablecer la contraseña. */
export function tokenDeAlta(): string {
  return randomBytes(24).toString('base64url');
}

/** Cuánto vale un enlace de alta: dos días. Lo manda una persona por WhatsApp,
 *  así que tiene que sobrevivir a que lo lean al otro día. */
export const HORAS_DEL_ENLACE = 48;

/** La versión del documento de convivencia que se acepta al entrar. */
export const NORMAS_VERSION = '2024-03';
