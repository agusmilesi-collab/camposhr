/**
 * El enlace de las láminas para la persona evaluada: quién entra con qué token.
 *
 * Ver `supabase/laminas-enlaces.sql`. El token es toda la credencial, y vence.
 */

import 'server-only';
import { select } from '@/lib/supabase';
import { esTestConLaminas, type TestConLaminas } from '@/lib/laminas';

const TOKEN = /^lm_[A-Za-z0-9_-]{16,40}$/;

/** A qué test da paso ese token, o null si no existe o ya venció. */
export async function testDelToken(token: string): Promise<TestConLaminas | null> {
  if (!TOKEN.test(token)) return null;
  const filas = await select<{ test: string }>(
    'laminas_enlaces',
    `select=test&token=eq.${token}&vence_at=gt.${new Date().toISOString()}&limit=1`
  );
  const test = filas[0]?.test;
  return test && esTestConLaminas(test) ? test : null;
}

/** La lámina que marcó la evaluadora para ese token, o null si el token no vale. */
export async function laminaDelToken(token: string): Promise<{ lamina: number | null } | null> {
  if (!TOKEN.test(token)) return null;
  const filas = await select<{ lamina: number | null }>(
    'laminas_enlaces',
    `select=lamina&token=eq.${token}&vence_at=gt.${new Date().toISOString()}&limit=1`
  );
  return filas[0] ? { lamina: filas[0].lamina } : null;
}

/**
 * Si ese token abre la vista de prueba del Raven.
 *
 * Se copia desde Herramientas para mostrarle el test a alguien de afuera: abre
 * las 36 láminas sin sesión del OS, no guarda ninguna respuesta y vence al día.
 */
export async function esPruebaDeRaven(token: string): Promise<boolean> {
  if (!TOKEN.test(token)) return false;
  const filas = await select<{ token: string }>(
    'laminas_enlaces',
    `select=token&token=eq.${token}&test=eq.raven&vence_at=gt.${new Date().toISOString()}&limit=1`
  );
  return Boolean(filas[0]);
}
