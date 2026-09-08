/**
 * Quién está mirando la zona del inquilino.
 *
 * Cada pantalla lo pregunta antes de leer nada. El middleware ya rutea por
 * host, pero la puerta de verdad está acá: sin esto, abrir la dirección de otro
 * mes o de otra persona alcanzaría para ver lo ajeno.
 *
 * **Nunca se confía en un identificador que venga del navegador.** El que vale
 * es el de la cookie firmada, y sobre ese se filtran las reservas, la cuenta y
 * todo lo demás.
 */

import 'server-only';

import { cookies } from 'next/headers';
import { COOKIE, deLaCookie } from '@/lib/centro-cookie';
import { select } from '@/lib/supabase';
import type { Inquilino } from '@/lib/consultorios-calculo';

export async function inquilinoDeLaSesion(): Promise<Inquilino | null> {
  const id = await deLaCookie(cookies().get(COOKIE)?.value, process.env.CENTRO_SECRETO);
  if (!id) return null;
  const filas = await select<Inquilino>(
    'inquilinos',
    'select=id,nombre,correo,telefono,activo,hash,matricula,matricula_vence,dni_archivo,' +
      `matricula_archivo,llave_entregada,normas_version,normas_aceptadas_at&id=eq.${id}`
  );
  const yo = filas[0];
  // Una baja deja de entrar en el acto, sin esperar a que venza la cookie.
  return yo && yo.activo ? yo : null;
}

/**
 * El legajo que el documento de convivencia pide antes de usar el Centro.
 *
 * Alcanza con la matrícula cargada. Pidió además que estuviera vigente hasta el
 * 8/9/2026, y la fecha se sacó de la ficha porque nadie la llevaba: exigir un
 * dato que no se carga es dejar a todos sin poder reservar. La columna
 * `matricula_vence` sigue en la base con lo que se haya cargado.
 */
export function legajoAlDia(yo: Inquilino, hoy: string): boolean {
  return Boolean(yo.matricula);
}
