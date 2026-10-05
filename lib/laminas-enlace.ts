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
