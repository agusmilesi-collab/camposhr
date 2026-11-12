/**
 * El test de Raven, tomado desde el OS.
 *
 * Treinta y seis láminas (o doce, en la serie corta), ocho opciones numeradas cada una, cuarenta y cinco
 * minutos. Se puede volver a cualquier lámina y cambiar lo respondido mientras
 * quede tiempo: lo que vale es lo que está cargado cuando el reloj se acaba.
 *
 * El reloj lo lleva el servidor. El navegador muestra la cuenta, pero quien
 * decide si una respuesta llegó a tiempo es el momento en que se abrió la
 * primera lámina, guardado del lado de acá.
 */

import 'server-only';
import { select } from '@/lib/supabase';
import { SERIES, serieDe, type Serie } from '@/lib/raven';

/**
 * Cuál de las ocho opciones es la correcta en cada lámina.
 *
 * Es la clave del manual y vive del lado del servidor: si estuviera en el
 * paquete que se le manda al navegador, cualquiera que rinde el test podría
 * leerla antes de contestar.
 */
export const CLAVE: Record<number, number> = {
  1: 5, 2: 1, 3: 7, 4: 4, 5: 3, 6: 1,
  7: 6, 8: 1, 9: 8, 10: 4, 11: 5, 12: 6,
  13: 2, 14: 1, 15: 2, 16: 4, 17: 6, 18: 7,
  19: 3, 20: 8, 21: 8, 22: 7, 23: 6, 24: 3,
  25: 7, 26: 2, 27: 7, 28: 5, 29: 6, 30: 5,
  31: 4, 32: 8, 33: 5, 34: 1, 35: 3, 36: 2,
};

/**
 * La clave de la serie corta, las 12 láminas de `laminas/raven12/`.
 *
 * Resuelta lámina por lámina sobre los dibujos y confirmada por Agustín el
 * 12/11/2026.
 */
export const CLAVE_12: Record<number, number> = {
  1: 8, 2: 4, 3: 5, 4: 1, 5: 2, 6: 5,
  7: 6, 8: 3, 9: 7, 10: 8, 11: 7, 12: 6,
};

function claveDe(serie: Serie): Record<number, number> {
  return serie === 12 ? CLAVE_12 : CLAVE;
}

export function hayClave(serie: Serie = 36): boolean {
  return Object.keys(claveDe(serie)).length === SERIES[serie].laminas;
}

/** Cuántas acertó, o null si todavía no está cargada la clave. */
export function corregir(respuestas: Record<string, number>, serie: Serie = 36): number | null {
  if (!hayClave(serie)) return null;
  const clave = claveDe(serie);
  let aciertos = 0;
  for (let lamina = 1; lamina <= SERIES[serie].laminas; lamina++) {
    if (respuestas[String(lamina)] === clave[lamina]) aciertos++;
  }
  return aciertos;
}

export type Sesion = {
  id: string;
  evaluacion_id: string;
  token: string;
  iniciado_at: string | null;
  terminado_at: string | null;
  cierre: string | null;
  respuestas: Record<string, number>;
  /** De cuántas láminas es el test de esta sesión. */
  laminas: Serie;
};

export async function sesionPorToken(token: string): Promise<Sesion | null> {
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(token)) return null;
  const filas = await select<Omit<Sesion, 'laminas'> & { laminas?: number | null }>(
    'raven_sesiones',
    `select=id,evaluacion_id,token,iniciado_at,terminado_at,cierre,respuestas,laminas&token=eq.${token}&limit=1`
  );
  const f = filas[0];
  return f ? { ...f, laminas: serieDe(f.laminas) } : null;
}

/** Cuántos segundos le quedan, contados desde que abrió la primera lámina. */
export function segundosRestantes(
  iniciado: string | null,
  serie: Serie = 36,
  ahora = new Date()
): number {
  const total = SERIES[serie].minutos * 60;
  if (!iniciado) return total;
  const pasados = (ahora.getTime() - new Date(iniciado).getTime()) / 1000;
  return Math.max(0, Math.round(total - pasados));
}

/** El tiempo se terminó: lo que llegue después de esto no entra. */
export function seAcabo(s: Sesion, ahora = new Date()): boolean {
  if (s.terminado_at) return true;
  return s.iniciado_at !== null && segundosRestantes(s.iniciado_at, s.laminas, ahora) <= 0;
}
